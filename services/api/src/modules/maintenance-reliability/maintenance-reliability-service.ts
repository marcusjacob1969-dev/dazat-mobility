import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  PreShiftCheckProjection,
  SubmitPreShiftCheckRequest,
  VehicleMaintenanceProjection,
  VehicleMaintenanceRequirementProjection,
  VerifiedDriverPerkProjection
} from '@dazat/contracts';
import {
  canTransitionDriverAvailability,
  canTransitionFleetVehicleState,
  evaluateMaintenanceOperatingGate,
  evaluatePreShiftCheck,
  type DriverAvailabilityStatus,
  type FleetVehicleState,
  type MaintenanceUrgency
} from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class MaintenanceReliabilityNotFoundError extends Error {}
export class MaintenanceReliabilityForbiddenError extends Error {}
export class MaintenanceReliabilityConflictError extends Error {}
export class MaintenanceReliabilityIdempotencyConflictError extends Error {}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

interface MaintenanceGateRow {
  vehicle_id: string;
  plan_version_id: string | null;
  active_plan_present: boolean;
  active_requirements_present: boolean;
  highest_urgency: MaintenanceUrgency | null;
  all_services_restricted: boolean;
  unresolved_safety_critical_recall: boolean;
  restricted_service_codes: string[];
}

export async function getDriverVehicleMaintenanceProjection(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  vehicleId: string,
  requestedServiceCodes: readonly string[]
): Promise<VehicleMaintenanceProjection> {
  if (!actor.driverProfileId) throw new MaintenanceReliabilityForbiddenError('A Driver profile is required');
  const gate = await pool.query<MaintenanceGateRow & { open_defect_count: string | number }>(
    `SELECT gate.vehicle_id, gate.plan_version_id, gate.active_plan_present,
            gate.active_requirements_present, gate.highest_urgency,
            gate.all_services_restricted, gate.restricted_service_codes,
            gate.unresolved_safety_critical_recall,
            (SELECT count(*) FROM vehicle_fleet.vehicle_defect defect
              WHERE defect.vehicle_id = gate.vehicle_id AND defect.state NOT IN ('RESOLVED','CLOSED')) AS open_defect_count
       FROM vehicle_fleet.current_vehicle_maintenance_gate gate
      WHERE gate.vehicle_id = $2
        AND EXISTS (
          SELECT 1 FROM driver.current_driver_vehicle_authorisation authorisation
           WHERE authorisation.driver_profile_id = $1 AND authorisation.vehicle_id = gate.vehicle_id
        )`,
    [actor.driverProfileId, vehicleId]
  );
  if (!gate.rowCount) throw new MaintenanceReliabilityNotFoundError('Authorised vehicle not found');
  const row = gate.rows[0]!;
  const requirements = await pool.query<{
    requirement_id: string;
    requirement_code: string;
    source_type: VehicleMaintenanceRequirementProjection['sourceType'];
    urgency: VehicleMaintenanceRequirementProjection['urgency'];
    status: VehicleMaintenanceRequirementProjection['status'];
    due_at: Date | null;
    due_odometer: number | null;
  }>(
    `SELECT requirement_id, requirement_code, source_type, urgency, status, due_at, due_odometer
       FROM vehicle_fleet.current_maintenance_requirement
      WHERE vehicle_id = $1 ORDER BY
        CASE urgency WHEN 'DO_NOT_USE' THEN 1 WHEN 'SAFETY_REVIEW' THEN 2 WHEN 'OVERDUE' THEN 3 WHEN 'DUE_SOON' THEN 4 ELSE 5 END,
        due_at NULLS LAST, requirement_code`,
    [vehicleId]
  );
  const decision = evaluateMaintenanceOperatingGate({
    activePlanPresent: row.active_plan_present,
    activeRequirementsPresent: row.active_requirements_present,
    highestUrgency: row.highest_urgency,
    allServicesRestrictionActive: row.all_services_restricted,
    unresolvedSafetyCriticalRecall: row.unresolved_safety_critical_recall,
    restrictedServiceCodes: row.restricted_service_codes,
    requestedServiceCodes
  });
  return {
    vehicleId,
    activePlanPresent: row.active_plan_present,
    ...(row.plan_version_id ? { planVersionId: row.plan_version_id } : {}),
    ...(row.highest_urgency ? { highestUrgency: row.highest_urgency } : {}),
    operatingPermitted: decision.operatingPermitted,
    blockers: decision.blockers,
    restrictedServiceCodes: row.restricted_service_codes,
    unresolvedSafetyCriticalRecall: row.unresolved_safety_critical_recall,
    openDefectCount: Number(row.open_defect_count),
    requirements: requirements.rows.map((requirement) => ({
      requirementId: requirement.requirement_id,
      requirementCode: requirement.requirement_code,
      sourceType: requirement.source_type,
      urgency: requirement.urgency,
      status: requirement.status,
      ...(requirement.due_at ? { dueAt: requirement.due_at.toISOString() } : {}),
      ...(requirement.due_odometer === null ? {} : { dueOdometer: requirement.due_odometer })
    })),
    breakdownAloneProvesDriverNeglect: false,
    reliabilityIsDriverCompliance: false,
    source: 'AUTHORITATIVE_CURRENT_PROJECTION',
    evaluatedAt: new Date().toISOString()
  };
}

async function moveDriverOfflineIfSafe(
  client: Pick<PoolClient, 'query'>,
  driverProfileId: string,
  vehicleId: string,
  commandId: string
): Promise<void> {
  const availability = await client.query<{
    status: DriverAvailabilityStatus;
    version: string | number;
    vehicle_id: string | null;
  }>(
    `SELECT status, version, vehicle_id FROM driver.availability_state
      WHERE driver_profile_id = $1 FOR UPDATE`,
    [driverProfileId]
  );
  const row = availability.rows[0];
  if (!row || row.status === 'OFFLINE' || row.status === 'ASSIGNED' || row.vehicle_id !== vehicleId) return;
  if (!canTransitionDriverAvailability(row.status, 'OFFLINE')) return;
  const nextVersion = Number(row.version) + 1;
  await client.query(
    `UPDATE driver.availability_state
        SET status = 'OFFLINE', version = $2, region_code = NULL, vehicle_id = NULL,
            location = NULL, location_observed_at = NULL, location_source = NULL,
            location_confidence = NULL, updated_at = now()
      WHERE driver_profile_id = $1`,
    [driverProfileId, nextVersion]
  );
  await client.query(
    `INSERT INTO driver.availability_transition
       (driver_profile_id, from_status, to_status, version, command_id, reason_code)
     VALUES ($1, $2::driver.availability_status, 'OFFLINE', $3, $4, 'PRE_SHIFT_VEHICLE_CONCERN')`,
    [driverProfileId, row.status, nextVersion, commandId]
  );
}

async function openPassengerContinuityIfActive(
  client: Pick<PoolClient, 'query'>,
  actor: AuthenticatedPrincipal,
  vehicleId: string
): Promise<void> {
  const active = await client.query<{ journey_id: string }>(
    `SELECT journey.id AS journey_id
       FROM journey.journey journey
       JOIN dispatch.driver_assignment assignment ON assignment.id = journey.assignment_id
      WHERE assignment.driver_profile_id = $1 AND assignment.vehicle_id = $2
        AND assignment.status = 'ACTIVE' AND journey.status IN ('IN_PROGRESS','ARRIVING')
      ORDER BY journey.started_at DESC LIMIT 1`,
    [actor.driverProfileId!, vehicleId]
  );
  const journeyId = active.rows[0]?.journey_id;
  if (!journeyId) return;
  const continuity = await client.query<{ id: string }>(
    `INSERT INTO journey.continuity_case (journey_id, status, reason_code, opened_by)
     SELECT $1, 'OPEN', 'VEHICLE_CONCERN_REPORTED', $2
      WHERE NOT EXISTS (
        SELECT 1 FROM journey.continuity_case current_case
         WHERE current_case.journey_id = $1 AND current_case.status = 'OPEN'
      ) RETURNING id`,
    [journeyId, actor.personId]
  );
  if (continuity.rowCount) {
    await client.query(
      `INSERT INTO journey.continuity_case_transition
         (continuity_case_id, from_status, to_status, actor_type, actor_id, reason_code)
       VALUES ($1, NULL, 'OPEN', 'DRIVER_REPORT', $2, 'VEHICLE_CONCERN_REPORTED')`,
      [continuity.rows[0]!.id, actor.personId]
    );
  }
}

export async function submitDriverPreShiftCheck(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  vehicleId: string,
  request: SubmitPreShiftCheckRequest,
  idempotencyKey: string
): Promise<PreShiftCheckProjection> {
  if (!actor.driverProfileId) throw new MaintenanceReliabilityForbiddenError('A Driver profile is required');
  const occurredAt = new Date(request.occurredAt);
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 5 * 60_000
      || occurredAt.getTime() < Date.now() - 24 * 60 * 60_000) {
    throw new MaintenanceReliabilityConflictError('Pre-shift observation time must be within the last 24 hours');
  }
  const decision = evaluatePreShiftCheck({
    items: request.items,
    uncertainConcernText: request.uncertainConcernText ?? null
  });
  const requestFingerprint = fingerprint({ vehicleId, request });
  const commandId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const vehicle = await client.query<{ fleet_state: FleetVehicleState; fleet_state_version: string | number }>(
      `SELECT vehicle.fleet_state, vehicle.fleet_state_version
         FROM vehicle_fleet.vehicle vehicle
        WHERE vehicle.id = $2
          AND EXISTS (
            SELECT 1 FROM driver.current_driver_vehicle_authorisation authorisation
             WHERE authorisation.driver_profile_id = $1 AND authorisation.vehicle_id = vehicle.id
          ) FOR UPDATE`,
      [actor.driverProfileId, vehicleId]
    );
    if (!vehicle.rowCount) throw new MaintenanceReliabilityNotFoundError('Authorised vehicle not found');
    const existing = await client.query<{ request_fingerprint: string; response_body: PreShiftCheckProjection }>(
      `SELECT request_fingerprint, response_body FROM vehicle_fleet.command_deduplication
        WHERE command_type = 'SubmitPreShiftCheck' AND actor_id = $1 AND idempotency_key = $2`,
      [actor.driverProfileId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new MaintenanceReliabilityIdempotencyConflictError('Idempotency key was used for another pre-shift check');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const check = await client.query<{ id: string; recorded_at: Date }>(
      `INSERT INTO vehicle_fleet.vehicle_pre_shift_check
         (command_id, idempotency_key, driver_profile_id, vehicle_id, odometer, check_items,
          uncertain_concern_text, evidence_references, outcome, maintenance_urgency,
          vehicle_use_permitted, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11, $12)
       RETURNING id, recorded_at`,
      [commandId, idempotencyKey, actor.driverProfileId, vehicleId, request.odometer,
        JSON.stringify(request.items), request.uncertainConcernText ?? null,
        JSON.stringify(request.evidenceReferences ?? []), decision.outcome,
        decision.maintenanceUrgency, decision.vehicleUsePermitted, request.occurredAt]
    );
    const checkId = check.rows[0]!.id;
    let defectId: string | undefined;
    let restrictionId: string | undefined;
    if (decision.createDefect) {
      const evidence = request.evidenceReferences?.length
        ? [...request.evidenceReferences]
        : [`pre-shift-check:${checkId}`];
      const failedItems = Object.entries(request.items)
        .filter(([, result]) => result === 'FAIL' || result === 'NOT_SURE')
        .map(([item]) => item);
      const defect = await client.query<{ id: string }>(
        `INSERT INTO vehicle_fleet.vehicle_defect
           (vehicle_id, reported_by_driver_profile_id, source_type, pre_shift_check_id,
            category, description, reporter_safety_concern, evidence_references)
         VALUES ($1, $2, 'DRIVER_PRE_SHIFT', $3, $4, $5, true, $6::jsonb) RETURNING id`,
        [vehicleId, actor.driverProfileId, checkId,
          failedItems.length ? failedItems.join(',') : 'UNSPECIFIED_CONCERN',
          request.uncertainConcernText?.trim() || 'Driver reported an item requiring review without making a diagnosis.',
          JSON.stringify(evidence)]
      );
      defectId = defect.rows[0]!.id;
      const defectCommandId = randomUUID();
      await client.query(
        `INSERT INTO vehicle_fleet.vehicle_defect_transition
           (vehicle_defect_id, from_state, to_state, version, command_id, actor_type, actor_id, reason_code)
         VALUES ($1, NULL, 'OPEN', 1, $2, 'DRIVER_REPORT', $3, 'PRE_SHIFT_CONCERN')`,
        [defectId, defectCommandId, actor.personId]
      );
      const restriction = await client.query<{ id: string }>(
        `INSERT INTO vehicle_fleet.vehicle_restriction
           (vehicle_id, source_defect_id, scope, urgency, reason_code, evidence_references)
         VALUES ($1, $2, 'ALL_SERVICES', $3, 'PRE_SHIFT_CONCERN_REQUIRES_REVIEW', $4::jsonb)
         RETURNING id`,
        [vehicleId, defectId, decision.maintenanceUrgency, JSON.stringify(evidence)]
      );
      restrictionId = restriction.rows[0]!.id;
      const restrictionCommandId = randomUUID();
      await client.query(
        `INSERT INTO vehicle_fleet.vehicle_restriction_transition
           (vehicle_restriction_id, from_status, to_status, version, command_id, actor_type, actor_id, reason_code)
         VALUES ($1, NULL, 'ACTIVE', 1, $2, 'DRIVER_REPORT', $3, 'PRE_SHIFT_CONCERN')`,
        [restrictionId, restrictionCommandId, actor.personId]
      );
      const currentVehicle = vehicle.rows[0]!;
      if (currentVehicle.fleet_state !== 'QUARANTINED'
          && canTransitionFleetVehicleState(currentVehicle.fleet_state, 'QUARANTINED')) {
        const stateCommandId = randomUUID();
        const nextStateVersion = Number(currentVehicle.fleet_state_version) + 1;
        await client.query(
          `INSERT INTO vehicle_fleet.vehicle_state_transition
             (vehicle_id, from_state, to_state, version, command_id, actor_type, actor_id, reason_code, evidence_references)
           VALUES ($1, $2, 'QUARANTINED', $3, $4, 'SYSTEM', $5, 'PRE_SHIFT_CONCERN', $6::jsonb)`,
          [vehicleId, currentVehicle.fleet_state, nextStateVersion, stateCommandId, actor.personId, JSON.stringify(evidence)]
        );
        await client.query(
          `UPDATE vehicle_fleet.vehicle SET fleet_state = 'QUARANTINED', fleet_state_version = $2 WHERE id = $1`,
          [vehicleId, nextStateVersion]
        );
      }
      await moveDriverOfflineIfSafe(client, actor.driverProfileId, vehicleId, randomUUID());
      await openPassengerContinuityIfActive(client, actor, vehicleId);
      await client.query(
        `INSERT INTO vehicle_fleet.maintenance_outbox_message
           (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
         VALUES
           ('maintenance.defect-reported', 'VehicleDefect', $1, 1, $3, $4, $5::jsonb),
           ('maintenance.vehicle-restricted', 'VehicleRestriction', $2, 1, $3, $4, $6::jsonb)`,
        [defectId, restrictionId, commandId, defectCommandId,
          JSON.stringify({ defectId, vehicleId, preShiftCheckId: checkId, driverFaultFinding: false }),
          JSON.stringify({ vehicleRestrictionId: restrictionId, vehicleId, precautionaryNotFaultFinding: true })]
      );
    }
    const response: PreShiftCheckProjection = {
      checkId,
      vehicleId,
      outcome: decision.outcome,
      maintenanceUrgency: decision.maintenanceUrgency,
      vehicleUsePermitted: decision.vehicleUsePermitted,
      ...(defectId ? { defectId } : {}),
      ...(restrictionId ? { vehicleRestrictionId: restrictionId } : {}),
      driverDiagnosisRequired: false,
      createsDriverFaultFinding: false,
      recordedAt: check.rows[0]!.recorded_at.toISOString()
    };
    await client.query(
      `INSERT INTO vehicle_fleet.maintenance_outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
       VALUES ('maintenance.pre-shift-check-recorded', 'VehiclePreShiftCheck', $1, 1, $2, $3, $4::jsonb)`,
      [checkId, commandId, commandId, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO vehicle_fleet.command_deduplication
         (command_id, idempotency_key, command_type, actor_id, request_fingerprint, response_status, response_body)
       VALUES ($1, $2, 'SubmitPreShiftCheck', $3, $4, 200, $5::jsonb)`,
      [commandId, idempotencyKey, actor.driverProfileId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listCurrentVerifiedDriverPerks(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  regionCode: string
): Promise<readonly VerifiedDriverPerkProjection[]> {
  if (!actor.driverProfileId) throw new MaintenanceReliabilityForbiddenError('A Driver profile is required');
  const result = await pool.query<{
    perk_offer_id: string;
    programme_name: string;
    category: VerifiedDriverPerkProjection['category'];
    benefit_terms: string[];
    eligibility_terms: string[];
    redemption_route: string;
    provider_verified_at: Date;
    effective_until: Date | null;
  }>(
    `SELECT perk_offer_id, programme_name, category, benefit_terms, eligibility_terms,
            redemption_route, provider_verified_at, effective_until
       FROM driver.current_verified_perk_offer WHERE region_code = $1
       ORDER BY category, programme_name, perk_offer_id LIMIT 100`,
    [regionCode]
  );
  return result.rows.map((row) => ({
    perkOfferId: row.perk_offer_id,
    programmeName: row.programme_name,
    category: row.category,
    benefitTerms: row.benefit_terms,
    eligibilityTerms: row.eligibility_terms,
    redemptionRoute: row.redemption_route,
    providerVerifiedAt: row.provider_verified_at.toISOString(),
    ...(row.effective_until ? { effectiveUntil: row.effective_until.toISOString() } : {}),
    verifiedBeforeMarketing: true
  }));
}
