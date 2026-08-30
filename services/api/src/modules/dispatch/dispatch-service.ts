import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabasePool } from '../../db.js';
import type { ApiConfig } from '../../config.js';
import {
  assertDriverAvailabilityTransition,
  evaluateDriverDispatchEligibility,
  type BookingStatus,
  type DriverAvailabilityStatus,
  type DriverDispatchEligibilityDecision,
  type DriverEligibilityStatus
} from '@dazat/domain';
import type {
  AcceptDriverOfferResult,
  BookingDispatchProjection,
  DeclineDriverOfferResult,
  DriverAvailabilitySummary,
  DriverEligibilitySummary,
  DriverOfferSummary,
  SetDriverAvailabilityRequest,
  StartDispatchResult
} from '@dazat/contracts';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class DispatchNotFoundError extends Error {}
export class DispatchForbiddenError extends Error {}
export class DispatchConflictError extends Error {}
export class DriverNotEligibleError extends Error {
  constructor(readonly blockers: readonly string[]) {
    super(`Driver is not eligible: ${blockers.join(', ')}`);
  }
}

interface InternalEligibility {
  readonly decision: DriverDispatchEligibilityDecision;
  readonly driverProfileId: string;
  readonly vehicleId: string | null;
  readonly complianceSnapshotId: string | null;
  readonly complianceValidUntil: Date | null;
  readonly vehicleSnapshotId: string | null;
  readonly vehicleValidUntil: Date | null;
  readonly serviceCapabilities: Readonly<Record<string, unknown>>;
  readonly availabilityVersion: number;
  readonly availabilityStatus: DriverAvailabilityStatus;
}

interface BookingDispatchContext {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly aggregateVersion: number;
  readonly regionCode: string;
  readonly scheduledFor: Date | null;
  readonly pickup: { latitude: number; longitude: number; displayLabel: string; structuredAddress: Record<string, string> };
  readonly dropoff: { latitude: number; longitude: number; displayLabel: string; structuredAddress: Record<string, string> };
  readonly requirements: readonly { type: string; value: Readonly<Record<string, unknown>> }[];
}

function hardRequirementsMatch(
  requirements: BookingDispatchContext['requirements'],
  capabilities: Readonly<Record<string, unknown>>
): boolean {
  return requirements.every((requirement) => {
    const actual = capabilities[requirement.type];
    if (actual === undefined) return false;
    if (typeof actual !== 'object' || actual === null) return actual === requirement.value || actual === true;
    return Object.entries(requirement.value).every(([key, expected]) => (
      (actual as Record<string, unknown>)[key] === expected
    ));
  });
}

function requiredPermissionServiceCodes(
  requirements: BookingDispatchContext['requirements']
): readonly string[] {
  const types = requirements.map((requirement) => requirement.type.trim().toUpperCase());
  const services = new Set<string>();
  if (types.some((type) => type.includes('SCHOOL'))) services.add('SCHOOL');
  if (types.some((type) => type.includes('WAV') || type.includes('WHEELCHAIR'))) services.add('WAV');
  if (types.some((type) => type.includes('HOSPITAL'))) services.add('HOSPITAL');
  if (types.some((type) => type.includes('SPECIALIST') || type.includes('HANDOVER'))) services.add('SPECIALIST');
  if (!services.size) services.add('STANDARD');
  return [...services].sort();
}

function maintenancePermitsServices(
  operatingPermitted: boolean | null,
  restrictedServiceCodes: readonly string[] | null,
  requestedServiceCodes: readonly string[]
): boolean {
  if (operatingPermitted !== true) return false;
  const restricted = new Set(restrictedServiceCodes ?? []);
  return !requestedServiceCodes.some((serviceCode) => restricted.has(serviceCode));
}

async function readDriverEligibility(
  client: Pick<PoolClient, 'query'>,
  actor: AuthenticatedPrincipal,
  vehicleId: string | null,
  regionCode: string | null,
  config: ApiConfig,
  requirements: BookingDispatchContext['requirements'] = [],
  requiredServiceCodes: readonly string[] = requiredPermissionServiceCodes(requirements)
): Promise<InternalEligibility> {
  if (!actor.driverProfileId) throw new DispatchForbiddenError('A Driver profile is required');
  const result = await client.query<{
    onboarding_status: string;
    availability_status: DriverAvailabilityStatus | null;
    availability_version: string | number | null;
    location_observed_at: Date | null;
    location_confidence: string | number | null;
    compliance_snapshot_id: string | null;
    compliance_status: DriverEligibilityStatus | null;
    compliance_valid_until: Date | null;
    vehicle_snapshot_id: string | null;
    vehicle_status: DriverEligibilityStatus | null;
    vehicle_valid_until: Date | null;
    service_capabilities: Record<string, unknown> | null;
    vehicle_authorised: boolean;
    active_assignment: boolean;
    service_permission_match: boolean;
    operating_restriction_active: boolean;
    maintenance_operating_permitted: boolean | null;
    maintenance_restricted_service_codes: string[] | null;
  }>(
    `SELECT dp.onboarding_status,
            av.status AS availability_status,
            av.version AS availability_version,
            av.location_observed_at,
            av.location_confidence,
            des.id AS compliance_snapshot_id,
            des.status AS compliance_status,
            des.valid_until AS compliance_valid_until,
            ves.id AS vehicle_snapshot_id,
            ves.status AS vehicle_status,
            ves.valid_until AS vehicle_valid_until,
            ves.service_capabilities,
            maintenance.operating_permitted AS maintenance_operating_permitted,
            maintenance.restricted_service_codes AS maintenance_restricted_service_codes,
            EXISTS (
              SELECT 1 FROM driver.current_driver_vehicle_authorisation dva
               WHERE dva.driver_profile_id = dp.id
                 AND dva.vehicle_id = $2
            ) AS vehicle_authorised,
            EXISTS (
              SELECT 1 FROM dispatch.driver_assignment da
               WHERE da.driver_profile_id = dp.id AND da.status = 'ACTIVE'
            ) AS active_assignment,
            CASE
              WHEN $3::text IS NULL THEN false
              WHEN cardinality($4::text[]) = 0 THEN EXISTS (
                SELECT 1 FROM driver.current_permission_projection permission
                 WHERE permission.driver_profile_id = dp.id AND permission.region_code = $3
                   AND NOT EXISTS (
                     SELECT 1 FROM driver.driver_restriction scoped_restriction
                      WHERE scoped_restriction.driver_profile_id = dp.id AND scoped_restriction.status = 'ACTIVE'
                        AND scoped_restriction.effective_from <= now()
                        AND (scoped_restriction.effective_until IS NULL OR scoped_restriction.effective_until > now())
                        AND (
                          (scoped_restriction.scope = 'SCHOOL_ONLY' AND permission.service_code LIKE '%SCHOOL%')
                          OR (scoped_restriction.scope = 'WAV_ONLY' AND permission.service_code LIKE '%WAV%')
                        )
                   )
              )
              ELSE NOT EXISTS (
                SELECT 1 FROM unnest($4::text[]) required_service(service_code)
                 WHERE NOT EXISTS (
                   SELECT 1 FROM driver.current_permission_projection permission
                    WHERE permission.driver_profile_id = dp.id AND permission.region_code = $3
                      AND permission.service_code = required_service.service_code
                 )
              )
            END AS service_permission_match,
            EXISTS (
              SELECT 1 FROM driver.driver_restriction restriction
               WHERE restriction.driver_profile_id = dp.id AND restriction.status = 'ACTIVE'
                 AND restriction.effective_from <= now()
                 AND (restriction.effective_until IS NULL OR restriction.effective_until > now())
                 AND (
                   restriction.scope IN ('ALL_SERVICES','NEW_JOURNEYS')
                   OR (restriction.scope = 'SPECIFIC_VEHICLE' AND restriction.vehicle_id = $2)
                   OR (restriction.scope = 'SCHOOL_ONLY' AND 'SCHOOL' = ANY($4::text[]))
                   OR (restriction.scope = 'WAV_ONLY' AND 'WAV' = ANY($4::text[]))
                 )
            ) AS operating_restriction_active
       FROM driver.driver_profile dp
       LEFT JOIN driver.availability_state av ON av.driver_profile_id = dp.id
       LEFT JOIN LATERAL (
         SELECT s.id, s.status, s.valid_until
           FROM compliance.driver_eligibility_snapshot s
          WHERE s.driver_profile_id = dp.id
          ORDER BY s.evaluated_at DESC LIMIT 1
       ) des ON true
       LEFT JOIN LATERAL (
         SELECT s.id, s.status, s.valid_until, s.service_capabilities
           FROM compliance.vehicle_eligibility_snapshot s
          WHERE s.vehicle_id = $2
          ORDER BY s.evaluated_at DESC LIMIT 1
       ) ves ON true
       LEFT JOIN vehicle_fleet.current_vehicle_maintenance_gate maintenance
         ON maintenance.vehicle_id = $2
      WHERE dp.id = $1`,
    [actor.driverProfileId, vehicleId, regionCode, requiredServiceCodes]
  );
  if (!result.rowCount) throw new DispatchNotFoundError('Driver profile not found');
  const row = result.rows[0]!;
  const capabilities = row.service_capabilities ?? {};
  const decision = evaluateDriverDispatchEligibility({
    accountActive: actor.accountStatus === 'ACTIVE',
    driverProfileApproved: row.onboarding_status === 'APPROVED',
    complianceStatus: row.compliance_status,
    complianceValidUntil: row.compliance_valid_until,
    vehicleAuthorised: Boolean(vehicleId) && row.vehicle_authorised,
    vehicleStatus: maintenancePermitsServices(
      row.maintenance_operating_permitted,
      row.maintenance_restricted_service_codes,
      requiredServiceCodes
    ) ? row.vehicle_status : 'INELIGIBLE',
    vehicleValidUntil: row.vehicle_valid_until,
    servicePermissionMatch: row.service_permission_match,
    operatingRestrictionActive: row.operating_restriction_active,
    availabilityStatus: row.availability_status ?? 'OFFLINE',
    locationObservedAt: row.location_observed_at,
    locationConfidence: row.location_confidence === null ? null : Number(row.location_confidence),
    minimumLocationConfidence: config.dispatchMinimumLocationConfidence,
    maxLocationAgeSeconds: config.dispatchLocationMaxAgeSeconds,
    hasActiveAssignment: row.active_assignment,
    hasScheduleConflict: false,
    hardRequirementsMatch: hardRequirementsMatch(requirements, capabilities)
  });
  return {
    decision,
    driverProfileId: actor.driverProfileId,
    vehicleId,
    complianceSnapshotId: row.compliance_snapshot_id,
    complianceValidUntil: row.compliance_valid_until,
    vehicleSnapshotId: row.vehicle_snapshot_id,
    vehicleValidUntil: row.vehicle_valid_until,
    serviceCapabilities: capabilities,
    availabilityVersion: Number(row.availability_version ?? 0),
    availabilityStatus: row.availability_status ?? 'OFFLINE'
  };
}

function publicEligibility(value: InternalEligibility): DriverEligibilitySummary {
  return {
    driverProfileId: value.driverProfileId,
    ...(value.vehicleId ? { vehicleId: value.vehicleId } : {}),
    eligible: value.decision.eligible,
    blockers: value.decision.blockers,
    ...(value.complianceValidUntil ? { complianceValidUntil: value.complianceValidUntil.toISOString() } : {}),
    ...(value.vehicleValidUntil ? { vehicleValidUntil: value.vehicleValidUntil.toISOString() } : {})
  };
}

export async function getDriverEligibility(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  vehicleId: string | null,
  regionCode: string,
  config: ApiConfig
): Promise<DriverEligibilitySummary> {
  return publicEligibility(await readDriverEligibility(pool, actor, vehicleId, regionCode, config, [], []));
}

export async function setDriverAvailability(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: SetDriverAvailabilityRequest,
  idempotencyKey: string,
  config: ApiConfig
): Promise<DriverAvailabilitySummary> {
  if (!actor.driverProfileId) throw new DispatchForbiddenError('A Driver profile is required');
  const desired = request.status;
  const goingOnline = desired === 'AVAILABLE' || desired === 'FINISHING_SOON';
  if (goingOnline && (!request.vehicleId || !request.regionCode || !request.location)) {
    throw new DriverNotEligibleError(['VEHICLE_NOT_AUTHORISED', 'LOCATION_MISSING']);
  }
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    const existingCommand = await client.query<{ response_body: DriverAvailabilitySummary }>(
      `SELECT response_body FROM dispatch.command_deduplication
        WHERE command_type = 'SetDriverAvailability' AND subject_id = $1 AND idempotency_key = $2`,
      [actor.driverProfileId, idempotencyKey]
    );
    if (existingCommand.rowCount) {
      await client.query('COMMIT');
      return existingCommand.rows[0]!.response_body;
    }
    const locked = await client.query<{ status: DriverAvailabilityStatus; version: string | number; vehicle_id: string | null }>(
      `SELECT status, version, vehicle_id FROM driver.availability_state
        WHERE driver_profile_id = $1 FOR UPDATE`,
      [actor.driverProfileId]
    );
    const from = locked.rowCount ? locked.rows[0]!.status : 'OFFLINE';
    assertDriverAvailabilityTransition(from, desired);
    const vehicleId = goingOnline ? request.vehicleId! : (request.vehicleId ?? locked.rows[0]?.vehicle_id ?? null);

    if (goingOnline) {
      const observedAt = new Date(request.location!.observedAt);
      if (Number.isNaN(observedAt.getTime())) throw new DriverNotEligibleError(['LOCATION_MISSING']);
      if (request.location!.confidence < 0 || request.location!.confidence > 1) throw new DriverNotEligibleError(['LOCATION_CONFIDENCE_LOW']);
      const preliminary = await readDriverEligibility(client, actor, vehicleId, request.regionCode!, config, [], []);
      const blockers = preliminary.decision.blockers.filter((blocker) => !['NOT_AVAILABLE', 'LOCATION_MISSING', 'LOCATION_STALE', 'LOCATION_CONFIDENCE_LOW'].includes(blocker));
      if (Date.now() - observedAt.getTime() > config.dispatchLocationMaxAgeSeconds * 1_000) blockers.push('LOCATION_STALE');
      if (observedAt.getTime() > Date.now() + 30_000) blockers.push('LOCATION_STALE');
      if (request.location!.confidence < config.dispatchMinimumLocationConfidence) blockers.push('LOCATION_CONFIDENCE_LOW');
      if (blockers.length) throw new DriverNotEligibleError([...new Set(blockers)]);
    }

    const nextVersion = Number(locked.rows[0]?.version ?? 0) + 1;
    const upsert = await client.query<{
      status: DriverAvailabilityStatus;
      version: string | number;
      region_code: string | null;
      vehicle_id: string | null;
      location_observed_at: Date | null;
    }>(
      `INSERT INTO driver.availability_state
         (driver_profile_id, status, version, region_code, vehicle_id, location, location_observed_at, location_source, location_confidence)
       VALUES (
         $1, $2::driver.availability_status, $3, $4, $5,
         CASE WHEN $6::double precision IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography END,
         $8, $9, $10
       )
       ON CONFLICT (driver_profile_id) DO UPDATE SET
         status = EXCLUDED.status,
         version = EXCLUDED.version,
         region_code = CASE WHEN EXCLUDED.status = 'OFFLINE' THEN NULL ELSE COALESCE(EXCLUDED.region_code, driver.availability_state.region_code) END,
         vehicle_id = CASE WHEN EXCLUDED.status = 'OFFLINE' THEN NULL ELSE COALESCE(EXCLUDED.vehicle_id, driver.availability_state.vehicle_id) END,
         location = CASE WHEN EXCLUDED.status = 'OFFLINE' THEN NULL ELSE COALESCE(EXCLUDED.location, driver.availability_state.location) END,
         location_observed_at = CASE WHEN EXCLUDED.status = 'OFFLINE' THEN NULL ELSE COALESCE(EXCLUDED.location_observed_at, driver.availability_state.location_observed_at) END,
         location_source = CASE WHEN EXCLUDED.status = 'OFFLINE' THEN NULL ELSE COALESCE(EXCLUDED.location_source, driver.availability_state.location_source) END,
         location_confidence = CASE WHEN EXCLUDED.status = 'OFFLINE' THEN NULL ELSE COALESCE(EXCLUDED.location_confidence, driver.availability_state.location_confidence) END,
         updated_at = now()
       RETURNING status, version, region_code, vehicle_id, location_observed_at`,
      [
        actor.driverProfileId,
        desired,
        nextVersion,
        goingOnline ? request.regionCode!.trim().toUpperCase() : null,
        goingOnline ? vehicleId : null,
        goingOnline ? request.location!.latitude : null,
        goingOnline ? request.location!.longitude : null,
        goingOnline ? request.location!.observedAt : null,
        goingOnline ? request.location!.source : null,
        goingOnline ? request.location!.confidence : null
      ]
    );
    await client.query(
      `INSERT INTO driver.availability_transition
         (driver_profile_id, from_status, to_status, version, command_id, reason_code)
       VALUES ($1, $2::driver.availability_status, $3::driver.availability_status, $4, $5, $6)`,
      [actor.driverProfileId, from, desired, nextVersion, commandId, `DRIVER_${desired}`]
    );
    const eligibility = desired === 'OFFLINE'
      ? await readDriverEligibility(client, actor, null, null, config, [], [])
      : await readDriverEligibility(client, actor, vehicleId, request.regionCode!, config, [], []);
    const row = upsert.rows[0]!;
    const response: DriverAvailabilitySummary = {
      driverProfileId: actor.driverProfileId,
      status: row.status,
      version: Number(row.version),
      ...(row.region_code ? { regionCode: row.region_code } : {}),
      ...(row.vehicle_id ? { vehicleId: row.vehicle_id } : {}),
      ...(row.location_observed_at ? { locationObservedAt: row.location_observed_at.toISOString() } : {}),
      eligibility: publicEligibility(eligibility)
    };
    await client.query(
      `INSERT INTO dispatch.command_deduplication
         (command_id, idempotency_key, command_type, subject_id, response_status, response_body)
       VALUES ($1, $2, 'SetDriverAvailability', $3, 200, $4::jsonb)`,
      [commandId, idempotencyKey, actor.driverProfileId, JSON.stringify(response)]
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

async function readBookingContext(client: Pick<PoolClient, 'query'>, bookingId: string): Promise<BookingDispatchContext> {
  const result = await client.query<{
    id: string; status: BookingStatus; aggregate_version: string | number; region_code: string; scheduled_for: Date | null;
    pickup_latitude: number; pickup_longitude: number; pickup_label: string; pickup_address: Record<string, string>;
    dropoff_latitude: number; dropoff_longitude: number; dropoff_label: string; dropoff_address: Record<string, string>;
  }>(
    `SELECT b.id, b.status, b.aggregate_version, b.region_code, b.scheduled_for,
            ST_Y(pu.point::geometry) AS pickup_latitude, ST_X(pu.point::geometry) AS pickup_longitude,
            pu.display_label AS pickup_label, pu.structured_address AS pickup_address,
            ST_Y(dr.point::geometry) AS dropoff_latitude, ST_X(dr.point::geometry) AS dropoff_longitude,
            dr.display_label AS dropoff_label, dr.structured_address AS dropoff_address
       FROM booking.booking b
       JOIN booking.location_snapshot pu ON pu.id = b.pickup_snapshot_id
       JOIN booking.location_snapshot dr ON dr.id = b.dropoff_snapshot_id
      WHERE b.id = $1`,
    [bookingId]
  );
  if (!result.rowCount) throw new DispatchNotFoundError('Booking not found');
  const requirements = await client.query<{ requirement_type: string; requirement_value: Record<string, unknown> }>(
    `SELECT requirement_type, requirement_value FROM booking.booking_requirement WHERE booking_id = $1`,
    [bookingId]
  );
  const row = result.rows[0]!;
  return {
    bookingId: row.id,
    status: row.status,
    aggregateVersion: Number(row.aggregate_version),
    regionCode: row.region_code,
    scheduledFor: row.scheduled_for,
    pickup: { latitude: Number(row.pickup_latitude), longitude: Number(row.pickup_longitude), displayLabel: row.pickup_label, structuredAddress: row.pickup_address },
    dropoff: { latitude: Number(row.dropoff_latitude), longitude: Number(row.dropoff_longitude), displayLabel: row.dropoff_label, structuredAddress: row.dropoff_address },
    requirements: requirements.rows.map((item) => ({ type: item.requirement_type, value: item.requirement_value }))
  };
}

async function assertBooker(client: Pick<PoolClient, 'query'>, bookingId: string, personId: string): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM booking.booking_party WHERE booking_id = $1 AND role = 'BOOKER' AND person_id = $2`,
    [bookingId, personId]
  );
  if (!result.rowCount) throw new DispatchForbiddenError('Booking is not available to this actor');
}

async function appendBookingTransition(
  client: Pick<PoolClient, 'query'>,
  context: BookingDispatchContext,
  to: BookingStatus,
  actorId: string | null,
  reasonCode: string,
  correlationId: string,
  commandId: string
): Promise<number> {
  const nextVersion = context.aggregateVersion + 1;
  const updated = await client.query(
    `UPDATE booking.booking SET status = $2::booking.booking_status, aggregate_version = $3, updated_at = now()
      WHERE id = $1 AND status = $4::booking.booking_status AND aggregate_version = $5`,
    [context.bookingId, to, nextVersion, context.status, context.aggregateVersion]
  );
  if (updated.rowCount !== 1) throw new DispatchConflictError('Booking changed while Dispatch was acting');
  await client.query(
    `INSERT INTO booking.booking_state_transition
       (booking_id, from_status, to_status, aggregate_version, command_id, actor_type, actor_id, reason_code)
     VALUES ($1, $2::booking.booking_status, $3::booking.booking_status, $4, $5, 'SYSTEM', $6, $7)`,
    [context.bookingId, context.status, to, nextVersion, commandId, actorId, reasonCode]
  );
  await client.query(
    `INSERT INTO booking.outbox_message
       (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
     VALUES ('Booking', $1, $2, $3, $4, $5, $6::jsonb)`,
    [context.bookingId, nextVersion, `booking.${to.toLowerCase()}`, correlationId, commandId, JSON.stringify({ bookingId: context.bookingId, from: context.status, to, aggregateVersion: nextVersion })]
  );
  return nextVersion;
}

export async function startBookingDispatch(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<StartDispatchResult> {
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    await assertBooker(client, bookingId, actor.personId);
    const existing = await client.query<{ response_body: StartDispatchResult }>(
      `SELECT response_body FROM dispatch.command_deduplication
        WHERE command_type = 'StartBookingDispatch' AND subject_id = $1 AND idempotency_key = $2`,
      [actor.accountId, idempotencyKey]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    await client.query('SELECT 1 FROM booking.booking WHERE id = $1 FOR UPDATE', [bookingId]);
    const context = await readBookingContext(client, bookingId);
    if (context.status !== 'READY_FOR_DISPATCH') throw new DispatchConflictError(`Expected READY_FOR_DISPATCH; found ${context.status}`);
    const searchingVersion = await appendBookingTransition(client, context, 'SEARCHING_FOR_DRIVER', actor.accountId, 'DISPATCH_STARTED', correlationId, commandId);
    const attempt = await client.query<{ id: string }>(
      `INSERT INTO dispatch.dispatch_attempt
         (booking_id, booking_aggregate_version, status, region_code, policy_version)
       VALUES ($1, $2, 'SEARCHING', $3, 'dispatch-foundation-v0.4') RETURNING id`,
      [bookingId, searchingVersion, context.regionCode]
    );
    const attemptId = attempt.rows[0]!.id;
    const requiredServices = requiredPermissionServiceCodes(context.requirements);
    const rawCandidates = await client.query<{
      driver_profile_id: string; vehicle_id: string; availability_version: string | number;
      availability_status: DriverAvailabilityStatus; location_observed_at: Date | null; location_confidence: string | number | null;
      onboarding_status: string; account_status: string; compliance_snapshot_id: string | null;
      compliance_status: DriverEligibilityStatus | null; compliance_valid_until: Date | null;
      vehicle_snapshot_id: string | null; vehicle_status: DriverEligibilityStatus | null; vehicle_valid_until: Date | null;
      service_capabilities: Record<string, unknown> | null; provisional_distance_metres: string | number | null;
      vehicle_authorised: boolean; active_assignment: boolean;
      service_permission_match: boolean; operating_restriction_active: boolean;
      current_permission_ids: string[]; active_restriction_ids: string[];
      maintenance_plan_version_id: string | null; maintenance_operating_permitted: boolean | null;
      maintenance_restricted_service_codes: string[] | null; vehicle_restriction_ids: string[] | null;
    }>(
      `SELECT av.driver_profile_id, av.vehicle_id, av.version AS availability_version,
              av.status AS availability_status, av.location_observed_at, av.location_confidence,
              dp.onboarding_status, ua.status AS account_status,
              des.id AS compliance_snapshot_id, des.status AS compliance_status, des.valid_until AS compliance_valid_until,
              ves.id AS vehicle_snapshot_id, ves.status AS vehicle_status, ves.valid_until AS vehicle_valid_until,
              ves.service_capabilities,
              maintenance.plan_version_id AS maintenance_plan_version_id,
              maintenance.operating_permitted AS maintenance_operating_permitted,
              maintenance.restricted_service_codes AS maintenance_restricted_service_codes,
              maintenance.active_restriction_ids AS vehicle_restriction_ids,
              round(ST_Distance(av.location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)) AS provisional_distance_metres,
              EXISTS (
                SELECT 1 FROM driver.current_driver_vehicle_authorisation dva
                 WHERE dva.driver_profile_id = av.driver_profile_id AND dva.vehicle_id = av.vehicle_id
              ) AS vehicle_authorised,
              EXISTS (
                SELECT 1 FROM dispatch.driver_assignment da
                 WHERE da.driver_profile_id = av.driver_profile_id AND da.status = 'ACTIVE'
              ) AS active_assignment,
              NOT EXISTS (
                SELECT 1 FROM unnest($4::text[]) required_service(service_code)
                 WHERE NOT EXISTS (
                   SELECT 1 FROM driver.current_permission_projection permission
                    WHERE permission.driver_profile_id = av.driver_profile_id
                      AND permission.region_code = $3 AND permission.service_code = required_service.service_code
                 )
              ) AS service_permission_match,
              EXISTS (
                SELECT 1 FROM driver.driver_restriction restriction
                 WHERE restriction.driver_profile_id = av.driver_profile_id AND restriction.status = 'ACTIVE'
                   AND restriction.effective_from <= now()
                   AND (restriction.effective_until IS NULL OR restriction.effective_until > now())
                   AND (
                     restriction.scope IN ('ALL_SERVICES','NEW_JOURNEYS')
                     OR (restriction.scope = 'SPECIFIC_VEHICLE' AND restriction.vehicle_id = av.vehicle_id)
                     OR (restriction.scope = 'SCHOOL_ONLY' AND 'SCHOOL' = ANY($4::text[]))
                     OR (restriction.scope = 'WAV_ONLY' AND 'WAV' = ANY($4::text[]))
                   )
              ) AS operating_restriction_active,
              ARRAY(
                SELECT permission.id FROM driver.current_permission_projection permission
                 WHERE permission.driver_profile_id = av.driver_profile_id
                   AND permission.region_code = $3 AND permission.service_code = ANY($4::text[])
                 ORDER BY permission.service_code, permission.id
              ) AS current_permission_ids,
              ARRAY(
                SELECT restriction.id FROM driver.driver_restriction restriction
                 WHERE restriction.driver_profile_id = av.driver_profile_id AND restriction.status = 'ACTIVE'
                   AND restriction.effective_from <= now()
                   AND (restriction.effective_until IS NULL OR restriction.effective_until > now())
                 ORDER BY restriction.id
              ) AS active_restriction_ids
         FROM driver.availability_state av
         JOIN driver.driver_profile dp ON dp.id = av.driver_profile_id
         JOIN identity.user_account ua ON ua.person_id = dp.person_id
         LEFT JOIN LATERAL (
           SELECT s.id, s.status, s.valid_until FROM compliance.driver_eligibility_snapshot s
            WHERE s.driver_profile_id = av.driver_profile_id ORDER BY s.evaluated_at DESC LIMIT 1
         ) des ON true
         LEFT JOIN LATERAL (
           SELECT s.id, s.status, s.valid_until, s.service_capabilities FROM compliance.vehicle_eligibility_snapshot s
            WHERE s.vehicle_id = av.vehicle_id ORDER BY s.evaluated_at DESC LIMIT 1
         ) ves ON true
         LEFT JOIN vehicle_fleet.current_vehicle_maintenance_gate maintenance
           ON maintenance.vehicle_id = av.vehicle_id
        WHERE av.region_code = $3 AND av.status IN ('AVAILABLE','FINISHING_SOON') AND av.location IS NOT NULL
        ORDER BY provisional_distance_metres ASC NULLS LAST, av.updated_at ASC
        LIMIT 200`,
      [context.pickup.latitude, context.pickup.longitude, context.regionCode, requiredServices]
    );
    const now = new Date();
    const eligible = rawCandidates.rows.filter((row) => evaluateDriverDispatchEligibility({
      accountActive: row.account_status === 'ACTIVE',
      driverProfileApproved: row.onboarding_status === 'APPROVED',
      complianceStatus: row.compliance_status,
      complianceValidUntil: row.compliance_valid_until,
      vehicleAuthorised: row.vehicle_authorised,
      vehicleStatus: maintenancePermitsServices(
        row.maintenance_operating_permitted,
        row.maintenance_restricted_service_codes,
        requiredServices
      ) ? row.vehicle_status : 'INELIGIBLE',
      vehicleValidUntil: row.vehicle_valid_until,
      servicePermissionMatch: row.service_permission_match,
      operatingRestrictionActive: row.operating_restriction_active,
      availabilityStatus: row.availability_status,
      locationObservedAt: row.location_observed_at,
      locationConfidence: row.location_confidence === null ? null : Number(row.location_confidence),
      minimumLocationConfidence: config.dispatchMinimumLocationConfidence,
      maxLocationAgeSeconds: config.dispatchLocationMaxAgeSeconds,
      hasActiveAssignment: row.active_assignment,
      hasScheduleConflict: false,
      hardRequirementsMatch: hardRequirementsMatch(context.requirements, row.service_capabilities ?? {})
    }, now).eligible);

    if (!eligible.length) {
      await client.query(`UPDATE dispatch.dispatch_attempt SET status = 'NO_ELIGIBLE_DRIVER', completed_at = now() WHERE id = $1`, [attemptId]);
      const noDriverContext: BookingDispatchContext = { ...context, status: 'SEARCHING_FOR_DRIVER', aggregateVersion: searchingVersion };
      await appendBookingTransition(client, noDriverContext, 'NO_ELIGIBLE_DRIVER', actor.accountId, 'HARD_FILTER_EXHAUSTED', correlationId, randomUUID());
      const response: StartDispatchResult = {
        bookingId, bookingStatus: 'NO_ELIGIBLE_DRIVER', dispatchAttemptId: attemptId,
        dispatchStatus: 'NO_ELIGIBLE_DRIVER', eligibleCandidateCount: 0, offeredDriverCount: 0
      };
      await client.query(
        `INSERT INTO dispatch.command_deduplication
           (command_id, idempotency_key, command_type, subject_id, response_status, response_body)
         VALUES ($1, $2, 'StartBookingDispatch', $3, 200, $4::jsonb)`,
        [commandId, idempotencyKey, actor.accountId, JSON.stringify(response)]
      );
      await client.query('COMMIT');
      return response;
    }

    let rank = 0;
    let offeredCount = 0;
    for (const row of eligible) {
      rank += 1;
      const candidate = await client.query<{ id: string }>(
        `INSERT INTO dispatch.candidate_snapshot
           (dispatch_attempt_id, driver_profile_id, vehicle_id, driver_eligibility_snapshot_id,
            vehicle_eligibility_snapshot_id, availability_version, provisional_pickup_distance_metres,
            rank_position, rank_factors, required_service_codes, driver_permission_ids, active_restriction_ids,
            vehicle_maintenance_plan_version_id, vehicle_restriction_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14) RETURNING id`,
        [attemptId, row.driver_profile_id, row.vehicle_id, row.compliance_snapshot_id, row.vehicle_snapshot_id,
          Number(row.availability_version), row.provisional_distance_metres === null ? null : Number(row.provisional_distance_metres),
          rank, JSON.stringify({ provisionalStraightLineDistanceOnly: true, hardFiltersPassed: true }),
          requiredServices, row.current_permission_ids, row.active_restriction_ids,
          row.maintenance_plan_version_id, row.vehicle_restriction_ids ?? []]
      );
      if (rank <= config.dispatchOfferWaveSize) {
        offeredCount += 1;
        const expiresAt = new Date(now.getTime() + config.dispatchOfferTtlSeconds * 1_000);
        await client.query(
          `INSERT INTO dispatch.driver_offer
             (dispatch_attempt_id, candidate_snapshot_id, booking_id, driver_profile_id, vehicle_id,
              wave_number, status, meaningful_offer_payload, expires_at)
           VALUES ($1,$2,$3,$4,$5,1,'OFFERED',$6::jsonb,$7)`,
          [attemptId, candidate.rows[0]!.id, bookingId, row.driver_profile_id, row.vehicle_id,
            JSON.stringify({ regionCode: context.regionCode, pickup: context.pickup, dropoff: context.dropoff,
              scheduledFor: context.scheduledFor?.toISOString() ?? null,
              provisionalPickupDistanceMetres: row.provisional_distance_metres === null ? null : Number(row.provisional_distance_metres),
              noAcceptanceRatePenaltyForDecline: true }), expiresAt.toISOString()]
        );
      }
    }
    await client.query(`UPDATE dispatch.dispatch_attempt SET status = 'OFFERING' WHERE id = $1`, [attemptId]);
    await client.query(
      `INSERT INTO dispatch.outbox_message
         (aggregate_type, aggregate_id, event_type, correlation_id, causation_id, payload)
       VALUES ('DispatchAttempt', $1, 'dispatch.offer_wave.created', $2, $3, $4::jsonb)`,
      [attemptId, correlationId, commandId, JSON.stringify({ attemptId, bookingId, eligibleCandidateCount: eligible.length, offeredDriverCount: offeredCount })]
    );
    const response: StartDispatchResult = {
      bookingId, bookingStatus: 'SEARCHING_FOR_DRIVER', dispatchAttemptId: attemptId,
      dispatchStatus: 'OFFERING', eligibleCandidateCount: eligible.length, offeredDriverCount: offeredCount
    };
    await client.query(
      `INSERT INTO dispatch.command_deduplication
         (command_id, idempotency_key, command_type, subject_id, response_status, response_body)
       VALUES ($1, $2, 'StartBookingDispatch', $3, 200, $4::jsonb)`,
      [commandId, idempotencyKey, actor.accountId, JSON.stringify(response)]
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

export async function listDriverOffers(pool: DatabasePool, actor: AuthenticatedPrincipal): Promise<readonly DriverOfferSummary[]> {
  if (!actor.driverProfileId) throw new DispatchForbiddenError('A Driver profile is required');
  await pool.query(
    `UPDATE dispatch.driver_offer SET status = 'EXPIRED', responded_at = now(), response_reason = 'TTL_EXPIRED'
      WHERE driver_profile_id = $1 AND status = 'OFFERED' AND expires_at <= now()`,
    [actor.driverProfileId]
  );
  const result = await pool.query<{
    id: string; dispatch_attempt_id: string; booking_id: string; status: string; expires_at: Date;
    meaningful_offer_payload: {
      regionCode: string; pickup: DriverOfferSummary['pickup']; dropoff: DriverOfferSummary['dropoff'];
      scheduledFor?: string | null; provisionalPickupDistanceMetres?: number | null;
    };
  }>(
    `SELECT id, dispatch_attempt_id, booking_id, status, expires_at, meaningful_offer_payload
       FROM dispatch.driver_offer
      WHERE driver_profile_id = $1 AND status = 'OFFERED' AND expires_at > now()
      ORDER BY offered_at ASC`,
    [actor.driverProfileId]
  );
  return result.rows.map((row) => ({
    offerId: row.id,
    dispatchAttemptId: row.dispatch_attempt_id,
    bookingId: row.booking_id,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    regionCode: row.meaningful_offer_payload.regionCode,
    pickup: row.meaningful_offer_payload.pickup,
    dropoff: row.meaningful_offer_payload.dropoff,
    ...(row.meaningful_offer_payload.scheduledFor ? { scheduledFor: row.meaningful_offer_payload.scheduledFor } : {}),
    ...(row.meaningful_offer_payload.provisionalPickupDistanceMetres !== null && row.meaningful_offer_payload.provisionalPickupDistanceMetres !== undefined
      ? { provisionalPickupDistanceMetres: row.meaningful_offer_payload.provisionalPickupDistanceMetres } : {})
  }));
}

export async function declineDriverOffer(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  offerId: string,
  reasonCode: 'NOT_SUITABLE' | 'TAKING_BREAK' | 'FINISHING_SOON' | 'OTHER',
  idempotencyKey: string
): Promise<DeclineDriverOfferResult> {
  if (!actor.driverProfileId) throw new DispatchForbiddenError('A Driver profile is required');
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    const offer = await client.query<{ driver_profile_id: string; status: string; expires_at: Date }>(
      `SELECT driver_profile_id, status, expires_at FROM dispatch.driver_offer WHERE id = $1 FOR UPDATE`,
      [offerId]
    );
    if (!offer.rowCount) throw new DispatchNotFoundError('Driver offer not found');
    if (offer.rows[0]!.driver_profile_id !== actor.driverProfileId) {
      throw new DispatchForbiddenError('Driver offer belongs to another Driver');
    }
    const dedupe = await client.query<{ response_body: DeclineDriverOfferResult }>(
      `SELECT response_body FROM dispatch.command_deduplication
        WHERE command_type = 'DeclineDriverOffer' AND subject_id = $1 AND idempotency_key = $2`,
      [actor.driverProfileId, idempotencyKey]
    );
    if (dedupe.rowCount) {
      await client.query('COMMIT');
      return dedupe.rows[0]!.response_body;
    }
    if (offer.rows[0]!.status !== 'OFFERED') throw new DispatchConflictError(`Offer is ${offer.rows[0]!.status}`);
    if (offer.rows[0]!.expires_at.getTime() <= Date.now()) throw new DispatchConflictError('Offer has expired');
    const declined = await client.query<{ responded_at: Date }>(
      `UPDATE dispatch.driver_offer
          SET status = 'DECLINED', responded_at = now(), response_reason = $2
        WHERE id = $1 RETURNING responded_at`,
      [offerId, reasonCode]
    );
    const response: DeclineDriverOfferResult = {
      offerId,
      status: 'DECLINED',
      declinedAt: declined.rows[0]!.responded_at.toISOString(),
      acceptanceRatePenaltyApplied: false
    };
    await client.query(
      `INSERT INTO dispatch.command_deduplication
         (command_id, idempotency_key, command_type, subject_id, response_status, response_body)
       VALUES ($1,$2,'DeclineDriverOffer',$3,200,$4::jsonb)`,
      [commandId, idempotencyKey, actor.driverProfileId, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO dispatch.outbox_message
         (aggregate_type, aggregate_id, event_type, causation_id, payload)
       VALUES ('DriverOffer', $1, 'dispatch.driver_offer.declined', $2, $3::jsonb)`,
      [offerId, commandId, JSON.stringify({ offerId, driverProfileId: actor.driverProfileId, reasonCode, acceptanceRatePenaltyApplied: false })]
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

export async function acceptDriverOffer(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  offerId: string,
  idempotencyKey: string,
  config: ApiConfig
): Promise<AcceptDriverOfferResult> {
  if (!actor.driverProfileId) throw new DispatchForbiddenError('A Driver profile is required');
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const offerLookup = await client.query<{ dispatch_attempt_id: string; driver_profile_id: string }>(
      `SELECT dispatch_attempt_id, driver_profile_id FROM dispatch.driver_offer WHERE id = $1`,
      [offerId]
    );
    if (!offerLookup.rowCount) throw new DispatchNotFoundError('Driver offer not found');
    if (offerLookup.rows[0]!.driver_profile_id !== actor.driverProfileId) {
      throw new DispatchForbiddenError('Driver offer belongs to another Driver');
    }
    const dedupe = await client.query<{ response_body: AcceptDriverOfferResult }>(
      `SELECT response_body FROM dispatch.command_deduplication
        WHERE command_type = 'AcceptDriverOffer' AND subject_id = $1 AND idempotency_key = $2`,
      [actor.driverProfileId, idempotencyKey]
    );
    if (dedupe.rowCount) {
      await client.query('COMMIT');
      return dedupe.rows[0]!.response_body;
    }
    const attempt = await client.query<{ status: string }>(
      `SELECT status FROM dispatch.dispatch_attempt WHERE id = $1 FOR UPDATE`,
      [offerLookup.rows[0]!.dispatch_attempt_id]
    );
    const offerResult = await client.query<{
      id: string; dispatch_attempt_id: string; booking_id: string; driver_profile_id: string;
      vehicle_id: string; status: string; expires_at: Date;
    }>(`SELECT id, dispatch_attempt_id, booking_id, driver_profile_id, vehicle_id, status, expires_at
          FROM dispatch.driver_offer WHERE id = $1 FOR UPDATE`, [offerId]);
    if (!offerResult.rowCount) throw new DispatchNotFoundError('Driver offer not found');
    const offer = offerResult.rows[0]!;
    if (offer.driver_profile_id !== actor.driverProfileId) throw new DispatchForbiddenError('Driver offer belongs to another Driver');
    if (attempt.rows[0]?.status !== 'OFFERING') throw new DispatchConflictError('Dispatch attempt is no longer accepting offers');
    if (offer.status !== 'OFFERED') throw new DispatchConflictError(`Offer is ${offer.status}`);
    if (offer.expires_at.getTime() <= Date.now()) {
      await client.query(`UPDATE dispatch.driver_offer SET status = 'EXPIRED', responded_at = now(), response_reason = 'TTL_EXPIRED' WHERE id = $1`, [offerId]);
      throw new DispatchConflictError('Offer expired before acceptance');
    }
    const booking = await readBookingContext(client, offer.booking_id);
    if (booking.status !== 'SEARCHING_FOR_DRIVER') throw new DispatchConflictError(`Booking is ${booking.status}`);
    const eligibility = await readDriverEligibility(client, actor, offer.vehicle_id, booking.regionCode, config, booking.requirements);
    if (!eligibility.decision.eligible) throw new DriverNotEligibleError(eligibility.decision.blockers);
    const assignment = await client.query<{ id: string; assigned_at: Date }>(
      `INSERT INTO dispatch.driver_assignment
         (dispatch_attempt_id, accepted_offer_id, booking_id, driver_profile_id, vehicle_id, status)
       VALUES ($1,$2,$3,$4,$5,'ACTIVE') RETURNING id, assigned_at`,
      [offer.dispatch_attempt_id, offer.id, offer.booking_id, actor.driverProfileId, offer.vehicle_id]
    );
    await client.query(`UPDATE dispatch.driver_offer SET status = 'ACCEPTED', responded_at = now() WHERE id = $1`, [offer.id]);
    await client.query(
      `UPDATE dispatch.driver_offer SET status = 'WITHDRAWN', responded_at = now(), response_reason = 'BOOKING_ASSIGNED'
        WHERE dispatch_attempt_id = $1 AND id <> $2 AND status = 'OFFERED'`,
      [offer.dispatch_attempt_id, offer.id]
    );
    await client.query(`UPDATE dispatch.dispatch_attempt SET status = 'ASSIGNED', completed_at = now() WHERE id = $1`, [offer.dispatch_attempt_id]);
    const availability = await client.query<{ status: DriverAvailabilityStatus; version: string | number }>(
      `SELECT status, version FROM driver.availability_state WHERE driver_profile_id = $1 FOR UPDATE`,
      [actor.driverProfileId]
    );
    if (!availability.rowCount) throw new DriverNotEligibleError(['NOT_AVAILABLE']);
    const nextAvailabilityVersion = Number(availability.rows[0]!.version) + 1;
    assertDriverAvailabilityTransition(availability.rows[0]!.status, 'ASSIGNED');
    await client.query(
      `UPDATE driver.availability_state SET status = 'ASSIGNED', version = $2, updated_at = now() WHERE driver_profile_id = $1`,
      [actor.driverProfileId, nextAvailabilityVersion]
    );
    await client.query(
      `INSERT INTO driver.availability_transition
         (driver_profile_id, from_status, to_status, version, command_id, reason_code)
       VALUES ($1,$2::driver.availability_status,'ASSIGNED',$3,$4,'OFFER_ACCEPTED')`,
      [actor.driverProfileId, availability.rows[0]!.status, nextAvailabilityVersion, randomUUID()]
    );
    await appendBookingTransition(client, booking, 'DRIVER_ASSIGNED', actor.accountId, 'DRIVER_OFFER_ACCEPTED', correlationId, commandId);
    await client.query(
      `INSERT INTO dispatch.outbox_message
         (aggregate_type, aggregate_id, event_type, correlation_id, causation_id, payload)
       VALUES ('DriverAssignment', $1, 'dispatch.driver.assigned', $2, $3, $4::jsonb)`,
      [assignment.rows[0]!.id, correlationId, commandId,
        JSON.stringify({ assignmentId: assignment.rows[0]!.id, bookingId: offer.booking_id, driverProfileId: actor.driverProfileId, vehicleId: offer.vehicle_id })]
    );
    const response: AcceptDriverOfferResult = {
      offerId: offer.id,
      assignmentId: assignment.rows[0]!.id,
      bookingId: offer.booking_id,
      bookingStatus: 'DRIVER_ASSIGNED',
      driverProfileId: actor.driverProfileId,
      vehicleId: offer.vehicle_id,
      assignedAt: assignment.rows[0]!.assigned_at.toISOString()
    };
    await client.query(
      `INSERT INTO dispatch.command_deduplication
         (command_id, idempotency_key, command_type, subject_id, response_status, response_body)
       VALUES ($1,$2,'AcceptDriverOffer',$3,200,$4::jsonb)`,
      [commandId, idempotencyKey, actor.driverProfileId, JSON.stringify(response)]
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

export async function getBookingDispatchProjection(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal
): Promise<BookingDispatchProjection> {
  await assertBooker(pool, bookingId, actor.personId);
  const result = await pool.query<{
    booking_status: string; dispatch_status: string | null; assignment_id: string | null;
    driver_profile_id: string | null; vehicle_id: string | null; assigned_at: Date | null;
  }>(
    `SELECT b.status AS booking_status, da.status AS dispatch_status,
            ass.id AS assignment_id, ass.driver_profile_id, ass.vehicle_id, ass.assigned_at
       FROM booking.booking b
       LEFT JOIN LATERAL (
         SELECT a.id, a.status FROM dispatch.dispatch_attempt a
          WHERE a.booking_id = b.id ORDER BY a.attempt_number DESC LIMIT 1
       ) da ON true
       LEFT JOIN dispatch.driver_assignment ass ON ass.dispatch_attempt_id = da.id AND ass.status = 'ACTIVE'
      WHERE b.id = $1`,
    [bookingId]
  );
  if (!result.rowCount) throw new DispatchNotFoundError('Booking not found');
  const row = result.rows[0]!;
  return {
    bookingId,
    bookingStatus: row.booking_status,
    ...(row.dispatch_status ? { dispatchStatus: row.dispatch_status } : {}),
    driverAssigned: Boolean(row.assignment_id),
    ...(row.assignment_id ? { assignmentId: row.assignment_id } : {}),
    ...(row.driver_profile_id ? { driverProfileId: row.driver_profile_id } : {}),
    ...(row.vehicle_id ? { vehicleId: row.vehicle_id } : {}),
    ...(row.assigned_at ? { assignedAt: row.assigned_at.toISOString() } : {})
  };
}
