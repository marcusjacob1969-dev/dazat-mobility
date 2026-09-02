import { createHash, randomUUID } from 'node:crypto';
import type { DatabasePool } from '../../db.js';
import type { ApiConfig } from '../../config.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import {
  assessDriverConnectivity,
  evaluateDriverSupportRouting,
  queuedCriticalEventSubmissionRoute,
  type DriverSupportCategory
} from '@dazat/domain';
import type {
  ArrivalCommunicationPlanProjection,
  ClearDriverFatigueAfterRestProjection,
  ConnectivityReconciliationProjection,
  ConnectivityReconciliationRequest,
  DriverDailyOperationsProjection,
  DriverFatigueSelfReportProjection,
  DriverFatigueSelfReportRequest,
  DriverSupplyProjection,
  DriverSupportCaseProjection,
  OpenDriverSupportCaseRequest
} from '@dazat/contracts';

export class DriverDailyOperationsNotFoundError extends Error {}
export class DriverDailyOperationsForbiddenError extends Error {}
export class DriverDailyOperationsConflictError extends Error {}
export class DriverDailyOperationsIdempotencyConflictError extends Error {}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireDriver(actor: AuthenticatedPrincipal): string {
  if (!actor.driverProfileId) throw new DriverDailyOperationsForbiddenError('A Driver profile is required');
  return actor.driverProfileId;
}

export async function getDriverDailyOperations(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  config: ApiConfig
): Promise<DriverDailyOperationsProjection> {
  const driverProfileId = requireDriver(actor);
  const projection = await pool.query<{
    availability_status: DriverDailyOperationsProjection['availabilityStatus'];
    availability_version: string | number;
    region_code: string | null;
    vehicle_id: string | null;
    shift_id: string | null;
    shift_started_at: Date | null;
    active_assignment_id: string | null;
    active_journey_id: string | null;
    active_journey_version: string | number | null;
    open_offer_count: string | number;
    posted_earning_count: string | number;
    open_support_case_count: string | number;
  }>(
    `SELECT availability_status, availability_version, region_code, vehicle_id,
            shift_id, shift_started_at, active_assignment_id, active_journey_id, active_journey_version,
            open_offer_count, posted_earning_count, open_support_case_count
       FROM driver.current_daily_operations_projection WHERE driver_profile_id = $1`,
    [driverProfileId]
  );
  if (!projection.rowCount) throw new DriverDailyOperationsNotFoundError('Driver profile not found');
  const row = projection.rows[0]!;
  const commitments = await pool.query<{
    id: string; booking_id: string; scheduled_for: Date; protected_from: Date; protected_until: Date;
    service_code: string; status: 'ACCEPTED' | 'CANCELLED' | 'COMPLETED' | 'MISSED';
  }>(
    `SELECT id, booking_id, scheduled_for, protected_from, protected_until, service_code, status
       FROM driver.scheduled_work_commitment
      WHERE driver_profile_id = $1 AND status = 'ACCEPTED' AND protected_until >= now()
      ORDER BY scheduled_for, id`,
    [driverProfileId]
  );
  const latestConnectivity = await pool.query<{
    connectivity_state: DriverDailyOperationsProjection['connectivity']['state'];
    reconciled_at: Date;
    authoritative_snapshot_required: boolean;
  }>(
    `SELECT connectivity_state, reconciled_at, authoritative_snapshot_required
       FROM driver.connectivity_reconciliation
      WHERE driver_profile_id = $1 ORDER BY reconciled_at DESC LIMIT 1`,
    [driverProfileId]
  );
  const now = new Date();
  const connectivityRow = latestConnectivity.rows[0];
  const connectivityStale = connectivityRow
    ? now.getTime() - connectivityRow.reconciled_at.getTime() > config.driverConnectivityFreshnessSeconds * 1_000
    : true;
  const connectivityState = !connectivityRow
    ? 'OFFLINE'
    : connectivityStale ? 'STALE' : connectivityRow.connectivity_state;
  return {
    driverProfileId,
    availabilityStatus: row.availability_status,
    availabilityVersion: Number(row.availability_version),
    ...(row.shift_id ? { shiftId: row.shift_id } : {}),
    ...(row.shift_started_at ? { shiftStartedAt: row.shift_started_at.toISOString() } : {}),
    ...(row.vehicle_id ? { selectedVehicleId: row.vehicle_id } : {}),
    ...(row.region_code ? { regionCode: row.region_code } : {}),
    operatingEligibilityEvaluatedSeparately: true,
    scheduledWork: commitments.rows.map((commitment) => ({
      commitmentId: commitment.id,
      bookingId: commitment.booking_id,
      scheduledFor: commitment.scheduled_for.toISOString(),
      protectedFrom: commitment.protected_from.toISOString(),
      protectedUntil: commitment.protected_until.toISOString(),
      serviceCode: commitment.service_code,
      status: commitment.status
    })),
    ...(row.active_assignment_id ? { activeAssignmentId: row.active_assignment_id } : {}),
    ...(row.active_journey_id ? { activeJourneyId: row.active_journey_id } : {}),
    ...(row.active_journey_version !== null ? { activeJourneyVersion: Number(row.active_journey_version) } : {}),
    openOfferCount: Number(row.open_offer_count),
    postedEarningCount: Number(row.posted_earning_count),
    openSupportCaseCount: Number(row.open_support_case_count),
    connectivity: {
      state: connectivityState,
      ...(connectivityRow ? { lastReconciledAt: connectivityRow.reconciled_at.toISOString() } : {}),
      authoritativeSnapshotRequired: !connectivityRow || connectivityStale || connectivityRow.authoritative_snapshot_required,
      speculativeStateMayBeTrusted: false
    },
    ordinaryAppLocationCollectionActive: row.availability_status !== 'OFFLINE',
    breakIsMisconduct: false,
    finishingSoonIsMisconduct: false,
    voiceReadoutConfigured: false,
    carPlayConfigured: false,
    androidAutoConfigured: false,
    voiceInputBypassesBackendValidation: false,
    source: 'AUTHORITATIVE_CURRENT_PROJECTION',
    evaluatedAt: now.toISOString()
  };
}

export async function reportDriverFatigue(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: DriverFatigueSelfReportRequest,
  idempotencyKey: string
): Promise<DriverFatigueSelfReportProjection> {
  const driverProfileId = requireDriver(actor);
  const observedAt = new Date(request.observedAt);
  const now = new Date();
  if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > now.getTime() + 30_000
    || now.getTime() - observedAt.getTime() > 86_400_000) {
    throw new DriverDailyOperationsConflictError('Fatigue observation time is outside the accepted evidence window');
  }
  const requestFingerprint = fingerprint(request);
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existingCommand = await client.query<{ request_fingerprint: string; response_body: DriverFatigueSelfReportProjection }>(
      `SELECT request_fingerprint, response_body FROM driver.daily_operations_command_deduplication
        WHERE command_type = 'ReportDriverFatigue' AND driver_profile_id = $1 AND idempotency_key = $2`,
      [driverProfileId, idempotencyKey]
    );
    if (existingCommand.rowCount) {
      if (existingCommand.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new DriverDailyOperationsIdempotencyConflictError('Idempotency key was already used for another fatigue report');
      }
      await client.query('COMMIT');
      return existingCommand.rows[0]!.response_body;
    }
    const shift = await client.query<{ id: string }>(
      `SELECT id FROM driver.driver_shift_session
        WHERE driver_profile_id = $1 AND status = 'ACTIVE' FOR UPDATE`,
      [driverProfileId]
    );
    if (!shift.rowCount) throw new DriverDailyOperationsConflictError('Fatigue self-report requires an active Driver shift');
    const shiftId = shift.rows[0]!.id;
    let observation = await client.query<{ id: string; created_at: Date }>(
      `SELECT id, created_at FROM driver.driver_fatigue_observation
        WHERE driver_shift_session_id = $1 AND observation_type = 'DRIVER_REPORTED_FATIGUE'
          AND status = 'ACTIVE' FOR UPDATE`,
      [shiftId]
    );
    if (!observation.rowCount) {
      observation = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO driver.driver_fatigue_observation
           (driver_profile_id, driver_shift_session_id, observation_type, source_type,
            evidence_reference, observed_at)
         VALUES ($1,$2,'DRIVER_REPORTED_FATIGUE','DRIVER_SELF_REPORT',$3,$4)
         RETURNING id, created_at`,
        [driverProfileId, shiftId, request.evidenceReference, observedAt]
      );
    }
    const fatigueObservationId = observation.rows[0]!.id;
    const active = await client.query<{
      journey_id: string; booking_id: string; vehicle_id: string;
    }>(
      `SELECT journey.id AS journey_id, assignment.booking_id, assignment.vehicle_id
         FROM dispatch.driver_assignment assignment
         JOIN journey.journey journey ON journey.booking_id = assignment.booking_id
        WHERE assignment.driver_profile_id = $1 AND assignment.status = 'ACTIVE'
          AND journey.status IN ('PASSENGER_VERIFIED','IN_PROGRESS','ARRIVING')
        ORDER BY assignment.assigned_at DESC LIMIT 1 FOR UPDATE OF assignment`,
      [driverProfileId]
    );
    const activeRow = active.rows[0];
    let operationalHoldId: string | undefined;
    let supportCaseId: string | undefined;
    if (activeRow) {
      let hold = await client.query<{ id: string }>(
        `SELECT id FROM journey.operational_hold
          WHERE journey_id = $1 AND reason_code = 'DRIVER_FATIGUE_REPORTED' AND status = 'ACTIVE' FOR UPDATE`,
        [activeRow.journey_id]
      );
      if (!hold.rowCount) {
        hold = await client.query<{ id: string }>(
          `INSERT INTO journey.operational_hold
             (journey_id, status, reason_code, source_type, source_id)
           VALUES ($1,'ACTIVE','DRIVER_FATIGUE_REPORTED','SAFETY',$2) RETURNING id`,
          [activeRow.journey_id, fatigueObservationId]
        );
        await client.query(
          `INSERT INTO journey.operational_hold_transition
             (operational_hold_id, from_status, to_status, actor_type, actor_id, reason_code)
           VALUES ($1,NULL,'ACTIVE','DRIVER',$2,'DRIVER_FATIGUE_REPORTED')`,
          [hold.rows[0]!.id, actor.personId]
        );
      }
      operationalHoldId = hold.rows[0]!.id;
      let support = await client.query<{ id: string }>(
        `SELECT id FROM operations.driver_support_case
          WHERE driver_profile_id = $1 AND journey_id = $2 AND category = 'SAFETY'
            AND summary_reference = $3
            AND status IN ('HUMAN_ESCALATION_REQUIRED','IN_PROGRESS')
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [driverProfileId, activeRow.journey_id, `fatigue-observation:${fatigueObservationId}`]
      );
      if (!support.rowCount) {
        support = await client.query<{ id: string }>(
          `INSERT INTO operations.driver_support_case
             (driver_profile_id, category, risk, status, journey_id, booking_id, vehicle_id,
              summary_reference, human_escalation_required, created_by_person_id)
           VALUES ($1,'SAFETY','HIGH_RISK_ACTIVE','HUMAN_ESCALATION_REQUIRED',$2,$3,$4,$5,true,$6)
           RETURNING id`,
          [driverProfileId, activeRow.journey_id, activeRow.booking_id, activeRow.vehicle_id,
            `fatigue-observation:${fatigueObservationId}`, actor.personId]
        );
        await client.query(
          `INSERT INTO operations.driver_support_case_event
             (support_case_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references)
           VALUES ($1,NULL,'HUMAN_ESCALATION_REQUIRED','DRIVER',$2,'ACTIVE_JOURNEY_FATIGUE_REPORTED',$3::jsonb)`,
          [support.rows[0]!.id, actor.personId, JSON.stringify([`fatigue-observation:${fatigueObservationId}`])]
        );
      }
      supportCaseId = support.rows[0]!.id;
    } else {
      const availability = await client.query<{ status: string; version: string | number }>(
        `SELECT status, version FROM driver.availability_state
          WHERE driver_profile_id = $1 AND status IN ('AVAILABLE','OFFERED','FINISHING_SOON') FOR UPDATE`,
        [driverProfileId]
      );
      if (availability.rowCount) {
        const nextVersion = Number(availability.rows[0]!.version) + 1;
        await client.query(
          `UPDATE driver.availability_state SET status = 'BREAK', version = $2, updated_at = now()
            WHERE driver_profile_id = $1`,
          [driverProfileId, nextVersion]
        );
        await client.query(
          `INSERT INTO driver.driver_shift_event
             (driver_shift_session_id, driver_profile_id, event_type, from_availability,
              to_availability, availability_version, command_id, reason_code)
           VALUES ($1,$2,'WORK_INTENT_CHANGED',$3::driver.availability_status,$4::driver.availability_status,$5,$6,'DRIVER_FATIGUE_REPORTED')`,
          [shiftId, driverProfileId, availability.rows[0]!.status, 'BREAK', nextVersion, randomUUID()]
        );
      }
    }
    const response: DriverFatigueSelfReportProjection = {
      fatigueObservationId,
      driverShiftSessionId: shiftId,
      activeJourney: Boolean(activeRow),
      ...(activeRow ? { journeyId: activeRow.journey_id, bookingId: activeRow.booking_id } : {}),
      ...(operationalHoldId ? { operationalHoldId } : {}),
      ...(supportCaseId ? { supportCaseId } : {}),
      newOffersAllowed: false,
      newJourneyStartAllowed: false,
      breakRequired: true,
      controlRoomEscalationRequired: Boolean(activeRow),
      passengerContinuityRequired: Boolean(activeRow),
      driverFaultFindingCreated: false,
      externalServiceContacted: false,
      recordedAt: observation.rows[0]!.created_at.toISOString()
    };
    await client.query(
      `INSERT INTO driver.daily_operations_command_deduplication
         (command_id, idempotency_key, command_type, driver_profile_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'ReportDriverFatigue',$3,$4,201,$5::jsonb)`,
      [commandId, idempotencyKey, driverProfileId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO driver.daily_operations_outbox_message
         (event_type, aggregate_type, aggregate_id, correlation_id, causation_id, payload)
       VALUES ('driver.fatigue-self-reported','DriverFatigueObservation',$1,$2,$3,$4::jsonb)`,
      [fatigueObservationId, correlationId, commandId, JSON.stringify(response)]
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

export async function clearDriverFatigueAfterRest(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  fatigueObservationId: string,
  idempotencyKey: string,
  config: ApiConfig
): Promise<ClearDriverFatigueAfterRestProjection> {
  const driverProfileId = requireDriver(actor);
  const requestFingerprint = fingerprint({ fatigueObservationId });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      request_fingerprint: string;
      response_body: ClearDriverFatigueAfterRestProjection;
    }>(
      `SELECT request_fingerprint, response_body FROM driver.daily_operations_command_deduplication
        WHERE command_type = 'ClearDriverFatigueAfterRest' AND driver_profile_id = $1 AND idempotency_key = $2`,
      [driverProfileId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new DriverDailyOperationsIdempotencyConflictError('Idempotency key was already used for another fatigue clearance');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const observation = await client.query<{ driver_shift_session_id: string }>(
      `SELECT driver_shift_session_id FROM driver.driver_fatigue_observation
        WHERE id = $1 AND driver_profile_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
      [fatigueObservationId, driverProfileId]
    );
    if (!observation.rowCount) {
      throw new DriverDailyOperationsNotFoundError('Active fatigue observation not found for this Driver');
    }
    const shiftId = observation.rows[0]!.driver_shift_session_id;
    const shift = await client.query(
      `SELECT 1 FROM driver.driver_shift_session
        WHERE id = $1 AND driver_profile_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
      [shiftId, driverProfileId]
    );
    if (!shift.rowCount) throw new DriverDailyOperationsConflictError('Fatigue clearance requires the observation active shift');
    const activeWork = await client.query(
      `SELECT assignment.id
         FROM dispatch.driver_assignment assignment
         LEFT JOIN journey.journey journey ON journey.booking_id = assignment.booking_id
        WHERE assignment.driver_profile_id = $1
          AND (assignment.status = 'ACTIVE' OR journey.status IN ('ASSIGNED','ARRIVING','PASSENGER_VERIFIED','IN_PROGRESS'))
        LIMIT 1 FOR UPDATE OF assignment`,
      [driverProfileId]
    );
    if (activeWork.rowCount) {
      throw new DriverDailyOperationsConflictError('Controlled handover must complete before fatigue clearance');
    }
    const availability = await client.query<{ status: string; version: string | number }>(
      `SELECT status, version FROM driver.availability_state
        WHERE driver_profile_id = $1 FOR UPDATE`,
      [driverProfileId]
    );
    if (!availability.rowCount || availability.rows[0]!.status !== 'BREAK') {
      throw new DriverDailyOperationsConflictError('Driver must remain on BREAK throughout qualifying rest');
    }
    const rest = await client.query<{ server_now: Date; rest_minutes: string | number }>(
      `SELECT clock_timestamp() AS server_now,
              floor(extract(epoch FROM (clock_timestamp() - event.occurred_at)) / 60)::integer AS rest_minutes
         FROM driver.driver_shift_event event
        WHERE event.driver_shift_session_id = $1 AND event.to_availability = 'BREAK'
        ORDER BY event.occurred_at DESC LIMIT 1`,
      [shiftId]
    );
    if (!rest.rowCount || Number(rest.rows[0]!.rest_minutes) < config.driverFatigueMinimumQualifyingRestMinutes) {
      throw new DriverDailyOperationsConflictError('Server-evidenced qualifying rest is not yet complete');
    }
    const serverNow = rest.rows[0]!.server_now;
    const qualifyingRestMinutes = Number(rest.rows[0]!.rest_minutes);
    await client.query(
      `UPDATE driver.driver_fatigue_observation
          SET status = 'CLEARED', cleared_at = $3, cleared_by_person_id = $4,
              clear_reason = 'SERVER_EVIDENCED_QUALIFYING_REST'
        WHERE id = $1 AND driver_profile_id = $2`,
      [fatigueObservationId, driverProfileId, serverNow, actor.personId]
    );
    const updatedAvailability = await client.query<{ version: string | number }>(
      `UPDATE driver.availability_state
          SET version = version + 1, updated_at = $2
        WHERE driver_profile_id = $1 AND status = 'BREAK'
        RETURNING version`,
      [driverProfileId, serverNow]
    );
    const availabilityVersion = Number(updatedAvailability.rows[0]!.version);
    await client.query(
      `INSERT INTO driver.driver_shift_event
         (driver_shift_session_id, driver_profile_id, event_type, from_availability,
          to_availability, availability_version, command_id, reason_code, occurred_at)
       VALUES ($1,$2,'REST_COMPLETED','BREAK','BREAK',$3,$4,'SERVER_EVIDENCED_QUALIFYING_REST',$5)`,
      [shiftId, driverProfileId, availabilityVersion, commandId, serverNow]
    );
    const response: ClearDriverFatigueAfterRestProjection = {
      fatigueObservationId,
      driverShiftSessionId: shiftId,
      status: 'CLEARED',
      qualifyingRestMinutes,
      availabilityStatus: 'BREAK',
      availabilityVersion,
      automaticReturnToWork: false,
      activeJourneyChecked: true,
      driverFaultFindingCreated: false,
      clearedAt: serverNow.toISOString()
    };
    await client.query(
      `INSERT INTO driver.daily_operations_command_deduplication
         (command_id, idempotency_key, command_type, driver_profile_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'ClearDriverFatigueAfterRest',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, driverProfileId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO driver.daily_operations_outbox_message
         (event_type, aggregate_type, aggregate_id, correlation_id, causation_id, payload)
       VALUES ('driver.fatigue-rest-cleared','DriverFatigueObservation',$1,$2,$3,$4::jsonb)`,
      [fatigueObservationId, correlationId, commandId, JSON.stringify(response)]
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

export async function reconcileDriverConnectivity(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: ConnectivityReconciliationRequest,
  idempotencyKey: string,
  config: ApiConfig
): Promise<ConnectivityReconciliationProjection> {
  const driverProfileId = requireDriver(actor);
  const requestFingerprint = fingerprint(request);
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const driver = await client.query(
      'SELECT 1 FROM driver.driver_profile WHERE id = $1 AND person_id = $2 FOR UPDATE',
      [driverProfileId, actor.personId]
    );
    if (!driver.rowCount) throw new DriverDailyOperationsNotFoundError('Driver profile not found');
    const existing = await client.query<{ request_fingerprint: string; response_body: ConnectivityReconciliationProjection }>(
      `SELECT request_fingerprint, response_body FROM driver.daily_operations_command_deduplication
        WHERE command_type = 'ReconcileDriverConnectivity' AND driver_profile_id = $1 AND idempotency_key = $2`,
      [driverProfileId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new DriverDailyOperationsIdempotencyConflictError('Idempotency key was already used for another connectivity observation');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    await client.query(
      `INSERT INTO driver.availability_state (driver_profile_id, status, version)
       VALUES ($1, 'OFFLINE', 1) ON CONFLICT (driver_profile_id) DO NOTHING`,
      [driverProfileId]
    );
    const availability = await client.query<{
      status: DriverDailyOperationsProjection['availabilityStatus']; version: string | number;
    }>(
      'SELECT status, version FROM driver.availability_state WHERE driver_profile_id = $1 FOR SHARE',
      [driverProfileId]
    );
    const activeJourney = await client.query<{ id: string; aggregate_version: string | number }>(
      `SELECT journey.id, journey.aggregate_version
         FROM dispatch.driver_assignment assignment
         JOIN journey.journey journey ON journey.active_assignment_id = assignment.id
        WHERE assignment.driver_profile_id = $1 AND assignment.status = 'ACTIVE'
          AND journey.status <> 'COMPLETED'
        ORDER BY journey.updated_at DESC LIMIT 1`,
      [driverProfileId]
    );
    const observedAt = new Date(request.observedAt);
    const serverNow = new Date();
    if (observedAt.getTime() > serverNow.getTime() + 30_000) {
      throw new DriverDailyOperationsConflictError('Connectivity observation cannot be in the future');
    }
    const lastServerSyncAt = request.lastServerSyncAt ? new Date(request.lastServerSyncAt) : null;
    const assessment = assessDriverConnectivity({
      networkReachable: request.networkReachable,
      lastServerSyncAt,
      now: serverNow,
      maximumFreshAgeMs: config.driverConnectivityFreshnessSeconds * 1_000,
      authoritativeSnapshotApplied: request.knownAvailabilityVersion === Number(availability.rows[0]!.version)
        && (request.knownActiveJourneyId ?? null) === (activeJourney.rows[0]?.id ?? null)
        && (request.knownActiveJourneyVersion ?? null) === (activeJourney.rowCount ? Number(activeJourney.rows[0]!.aggregate_version) : null),
      queuedCriticalEventCount: request.queuedCriticalEvents.length
    });
    const reconciliationId = randomUUID();
    const reconciled = await client.query<{ reconciled_at: Date }>(
      `INSERT INTO driver.connectivity_reconciliation
         (id, driver_profile_id, client_observation_id, network_reachable, observed_at, last_server_sync_at,
          known_availability_version, known_active_journey_id, known_active_journey_version,
          queued_critical_events, queued_critical_event_count,
          authoritative_availability_status, authoritative_availability_version,
          authoritative_active_journey_id, authoritative_active_journey_version,
          connectivity_state, authoritative_snapshot_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17)
       RETURNING reconciled_at`,
      [reconciliationId, driverProfileId, request.clientObservationId, request.networkReachable,
        request.observedAt, request.lastServerSyncAt ?? null, request.knownAvailabilityVersion ?? null,
        request.knownActiveJourneyId ?? null, request.knownActiveJourneyVersion ?? null,
        JSON.stringify(request.queuedCriticalEvents), request.queuedCriticalEvents.length,
        availability.rows[0]!.status, Number(availability.rows[0]!.version), activeJourney.rows[0]?.id ?? null,
        activeJourney.rowCount ? Number(activeJourney.rows[0]!.aggregate_version) : null,
        assessment.state, assessment.authoritativeSnapshotRequired]
    );
    const response: ConnectivityReconciliationProjection = {
      reconciliationId,
      state: assessment.state,
      authoritativeAvailabilityStatus: availability.rows[0]!.status,
      authoritativeAvailabilityVersion: Number(availability.rows[0]!.version),
      ...(activeJourney.rows[0]?.id ? { authoritativeActiveJourneyId: activeJourney.rows[0].id } : {}),
      ...(activeJourney.rowCount ? { authoritativeActiveJourneyVersion: Number(activeJourney.rows[0]!.aggregate_version) } : {}),
      authoritativeSnapshotRequired: assessment.authoritativeSnapshotRequired,
      speculativeStateMayBeTrusted: false,
      queuedCriticalEventsExecuted: false,
      queuedCriticalEvents: request.queuedCriticalEvents.map((event) => ({
        clientEventId: event.clientEventId,
        kind: event.kind,
        submissionRoute: queuedCriticalEventSubmissionRoute(event.kind),
        status: 'REQUIRES_CANONICAL_SUBMISSION'
      })),
      reconciledAt: reconciled.rows[0]!.reconciled_at.toISOString()
    };
    await client.query(
      `INSERT INTO driver.daily_operations_command_deduplication
         (command_id, idempotency_key, command_type, driver_profile_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'ReconcileDriverConnectivity',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, driverProfileId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO driver.daily_operations_outbox_message
         (event_type, aggregate_type, aggregate_id, correlation_id, causation_id, payload)
       VALUES ('driver.connectivity-reconciled','ConnectivityReconciliation',$1,$2,$3,$4::jsonb)`,
      [reconciliationId, correlationId, commandId, JSON.stringify({
        reconciliationId, driverProfileId, state: assessment.state,
        queuedCriticalEventsExecuted: false, authoritativeSnapshotRequired: assessment.authoritativeSnapshotRequired
      })]
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

async function assertSupportContextOwned(
  pool: DatabasePool,
  driverProfileId: string,
  request: OpenDriverSupportCaseRequest
): Promise<void> {
  if (request.journeyId) {
    const journey = await pool.query<{ booking_id: string; vehicle_id: string }>(
      `SELECT journey.booking_id, assignment.vehicle_id
         FROM journey.journey journey
         JOIN dispatch.driver_assignment assignment ON assignment.id = journey.active_assignment_id
        WHERE journey.id = $1 AND assignment.driver_profile_id = $2`,
      [request.journeyId, driverProfileId]
    );
    if (!journey.rowCount) throw new DriverDailyOperationsForbiddenError('Journey does not belong to this Driver');
    if (request.bookingId && request.bookingId !== journey.rows[0]!.booking_id) {
      throw new DriverDailyOperationsConflictError('Support Booking does not match the Journey');
    }
    if (request.vehicleId && request.vehicleId !== journey.rows[0]!.vehicle_id) {
      throw new DriverDailyOperationsConflictError('Support vehicle does not match the Journey assignment');
    }
    return;
  }
  if (request.bookingId) {
    const assignment = await pool.query(
      'SELECT 1 FROM dispatch.driver_assignment WHERE booking_id = $1 AND driver_profile_id = $2',
      [request.bookingId, driverProfileId]
    );
    if (!assignment.rowCount) throw new DriverDailyOperationsForbiddenError('Booking does not belong to this Driver');
  }
  if (request.vehicleId) {
    const vehicle = await pool.query(
      `SELECT 1 FROM driver.driver_vehicle_authorisation
        WHERE driver_profile_id = $1 AND vehicle_id = $2 AND status IN ('ACTIVE','ENDED')`,
      [driverProfileId, request.vehicleId]
    );
    if (!vehicle.rowCount) throw new DriverDailyOperationsForbiddenError('Vehicle is not linked to this Driver');
  }
}

export async function openDriverSupportCase(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: OpenDriverSupportCaseRequest,
  idempotencyKey: string
): Promise<DriverSupportCaseProjection> {
  const driverProfileId = requireDriver(actor);
  await assertSupportContextOwned(pool, driverProfileId, request);
  const requestFingerprint = fingerprint(request);
  const routing = evaluateDriverSupportRouting({
    category: request.category as DriverSupportCategory,
    activeJourney: Boolean(request.journeyId),
    immediateDanger: request.immediateDanger,
    serviceContinuityAtRisk: request.serviceContinuityAtRisk
  });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ request_fingerprint: string; response_body: DriverSupportCaseProjection }>(
      `SELECT request_fingerprint, response_body FROM driver.daily_operations_command_deduplication
        WHERE command_type = 'OpenDriverSupportCase' AND driver_profile_id = $1 AND idempotency_key = $2`,
      [driverProfileId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new DriverDailyOperationsIdempotencyConflictError('Idempotency key was already used for another support case');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const status = routing.humanEscalationRequired ? 'HUMAN_ESCALATION_REQUIRED' : 'OPEN';
    const inserted = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO operations.driver_support_case
         (driver_profile_id, category, risk, status, journey_id, booking_id, vehicle_id,
          summary_reference, human_escalation_required, created_by_person_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at`,
      [driverProfileId, request.category, routing.risk, status, request.journeyId ?? null,
        request.bookingId ?? null, request.vehicleId ?? null, request.summaryReference,
        routing.humanEscalationRequired, actor.personId]
    );
    const supportCaseId = inserted.rows[0]!.id;
    await client.query(
      `INSERT INTO operations.driver_support_case_event
         (support_case_id, from_status, to_status, actor_type, actor_id, reason_code)
       VALUES ($1,NULL,$2,'DRIVER',$3,'DRIVER_SUPPORT_REQUESTED')`,
      [supportCaseId, status, actor.personId]
    );
    const response: DriverSupportCaseProjection = {
      supportCaseId,
      category: request.category,
      risk: routing.risk,
      status,
      ...(request.journeyId ? { journeyId: request.journeyId } : {}),
      ...(request.bookingId ? { bookingId: request.bookingId } : {}),
      ...(request.vehicleId ? { vehicleId: request.vehicleId } : {}),
      humanEscalationRequired: routing.humanEscalationRequired,
      externalServiceContacted: false,
      createdAt: inserted.rows[0]!.created_at.toISOString()
    };
    await client.query(
      `INSERT INTO driver.daily_operations_command_deduplication
         (command_id, idempotency_key, command_type, driver_profile_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'OpenDriverSupportCase',$3,$4,201,$5::jsonb)`,
      [commandId, idempotencyKey, driverProfileId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO driver.daily_operations_outbox_message
         (event_type, aggregate_type, aggregate_id, correlation_id, causation_id, payload)
       VALUES ('driver.support-case-opened','DriverSupportCase',$1,$2,$3,$4::jsonb)`,
      [supportCaseId, correlationId, commandId, JSON.stringify({
        supportCaseId, driverProfileId, category: request.category, risk: routing.risk,
        humanEscalationRequired: routing.humanEscalationRequired, externalServiceContacted: false
      })]
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

export async function listDriverSupportCases(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<readonly DriverSupportCaseProjection[]> {
  const driverProfileId = requireDriver(actor);
  const result = await pool.query<{
    id: string; category: DriverSupportCaseProjection['category']; risk: DriverSupportCaseProjection['risk'];
    status: DriverSupportCaseProjection['status']; journey_id: string | null; booking_id: string | null;
    vehicle_id: string | null; human_escalation_required: boolean; created_at: Date;
  }>(
    `SELECT id, category, risk, status, journey_id, booking_id, vehicle_id,
            human_escalation_required, created_at
       FROM operations.driver_support_case WHERE driver_profile_id = $1
      ORDER BY created_at DESC, id DESC LIMIT 100`,
    [driverProfileId]
  );
  return result.rows.map((row) => ({
    supportCaseId: row.id,
    category: row.category,
    risk: row.risk,
    status: row.status,
    ...(row.journey_id ? { journeyId: row.journey_id } : {}),
    ...(row.booking_id ? { bookingId: row.booking_id } : {}),
    ...(row.vehicle_id ? { vehicleId: row.vehicle_id } : {}),
    humanEscalationRequired: row.human_escalation_required,
    externalServiceContacted: false,
    createdAt: row.created_at.toISOString()
  }));
}

export async function getDriverSupplyDemand(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  regionCode: string,
  capabilityCodes: readonly string[]
): Promise<DriverSupplyProjection> {
  requireDriver(actor);
  const result = await pool.query<{
    id: string; kind: 'CURRENT_OBSERVATION' | 'FORECAST'; region_code: string; capability_code: string;
    demand_count: string | number; eligible_supply_count: string | number; observed_or_forecast_at: Date;
    confidence: string | number;
  }>(
    `SELECT id, kind, region_code, capability_code, demand_count, eligible_supply_count,
            observed_or_forecast_at, confidence
       FROM operations.current_supply_demand_projection
      WHERE region_code = $1 AND (cardinality($2::text[]) = 0 OR capability_code = ANY($2::text[]))
      ORDER BY capability_code, kind`,
    [regionCode, capabilityCodes]
  );
  return {
    regionCode,
    signals: result.rows.map((row) => ({
      observationId: row.id,
      kind: row.kind,
      regionCode: row.region_code,
      capabilityCode: row.capability_code,
      demandCount: Number(row.demand_count),
      eligibleSupplyCount: Number(row.eligible_supply_count),
      observedOrForecastAt: row.observed_or_forecast_at.toISOString(),
      confidence: Number(row.confidence),
      guaranteedEarnings: false,
      evidenceBacked: true
    })),
    currentAndForecastKeptSeparate: true,
    supplyMeasuredByCapability: true,
    guaranteedEarnings: false
  };
}

export async function getArrivalCommunicationPlan(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  bookingId: string
): Promise<ArrivalCommunicationPlanProjection> {
  const driverProfileId = requireDriver(actor);
  const result = await pool.query<{
    pickup_snapshot_id: string; display_label: string; structured_address: Record<string, string>;
    plan_status: string | null; version: string | number | null; channels: ArrivalCommunicationPlanProjection['channels'] | null;
    recipient_roles: string[] | null; driver_instructions: string[] | null;
  }>(
    `SELECT booking.pickup_snapshot_id, pickup.display_label, pickup.structured_address,
            plan.status AS plan_status, plan.version, plan.channels, plan.recipient_roles, plan.driver_instructions
       FROM booking.booking booking
       JOIN booking.location_snapshot pickup ON pickup.id = booking.pickup_snapshot_id
       JOIN dispatch.driver_assignment assignment ON assignment.booking_id = booking.id
        AND assignment.driver_profile_id = $2
       LEFT JOIN LATERAL (
         SELECT status, version, channels, recipient_roles, driver_instructions
           FROM communications.arrival_communication_plan_version
          WHERE booking_id = booking.id AND status = 'AUTHORISED'
          ORDER BY version DESC LIMIT 1
       ) plan ON true
      WHERE booking.id = $1
      ORDER BY assignment.assigned_at DESC LIMIT 1`,
    [bookingId, driverProfileId]
  );
  if (!result.rowCount) throw new DriverDailyOperationsForbiddenError('Booking is not assigned to this Driver');
  const row = result.rows[0]!;
  const configured = row.plan_status === 'AUTHORISED';
  return {
    bookingId,
    planStatus: configured ? 'CONFIGURED' : 'NOT_CONFIGURED',
    ...(configured && row.version !== null ? { version: Number(row.version) } : {}),
    pickup: {
      snapshotId: row.pickup_snapshot_id,
      displayLabel: row.display_label,
      structuredAddress: row.structured_address
    },
    passengerGpsAssumedAsPickup: false,
    channels: configured ? row.channels ?? [] : [],
    recipientRoles: configured ? row.recipient_roles ?? [] : [],
    driverInstructions: configured ? row.driver_instructions ?? [] : [],
    directContactDetailsExposed: false,
    communicationExecutionEnabled: false
  };
}
