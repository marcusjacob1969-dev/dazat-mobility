import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  assertCanonicalForwardTransition,
  assertJourneyTransition,
  canStartJourney,
  evaluateArrivalEvidence,
  evaluateLocationEvidence,
  evaluateRideCheckAttempt,
  type BookingStatus,
  type JourneyStatus,
  type RideCheckStatus,
  type TelemetryConfidenceState
} from '@dazat/domain';
import type {
  ArrivalResult,
  DriverAcknowledgementResult,
  DriverLocationObservationRequest,
  DriverLocationObservationResult,
  JourneyCommandResult,
  JourneyLiveProjection,
  StartRideCheckResult,
  VerifyRideCheckResult
} from '@dazat/contracts';
import type { ApiConfig } from '../../config.js';
import type { DatabasePool } from '../../db.js';
import { constantTimeHexEqual, createVerificationSalt, hashVerificationCode } from '../../security/secret-utils.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class JourneyNotFoundError extends Error {}
export class JourneyForbiddenError extends Error {}
export class JourneyConflictError extends Error {}
export class JourneyEvidenceError extends Error {
  constructor(readonly blockers: readonly string[]) {
    super(`Journey evidence rejected: ${blockers.join(', ')}`);
  }
}

export interface LockedJourney {
  readonly journeyId: string;
  readonly bookingId: string;
  readonly journeyStatus: JourneyStatus;
  readonly journeyVersion: number;
  readonly bookingStatus: BookingStatus;
  readonly bookingVersion: number;
  readonly assignmentId: string;
  readonly assignmentStatus: string;
  readonly driverProfileId: string;
  readonly vehicleId: string;
  readonly journeyLegId: string;
  readonly journeyLegStatus: string;
  readonly pickupSnapshotId: string;
  readonly pickupLatitude: number;
  readonly pickupLongitude: number;
  readonly dropoffSnapshotId: string;
  readonly dropoffLatitude: number;
  readonly dropoffLongitude: number;
  readonly passengerPersonId: string;
}

export interface LocationRow {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observed_at: Date;
  readonly received_at: Date;
  readonly accuracy_metres: string | number;
  readonly confidence: string | number;
  readonly telemetry_state: TelemetryConfidenceState;
  readonly movement_plausible: boolean;
  readonly movement_blocker: string | null;
}

export function journeyLocationPolicy(config: ApiConfig) {
  return {
    maxAgeSeconds: config.journeyLocationMaxAgeSeconds,
    maximumFutureSkewSeconds: config.journeyLocationMaximumFutureSkewSeconds,
    maximumAccuracyMetres: config.journeyLocationMaximumAccuracyMetres,
    minimumConfidence: config.journeyLocationMinimumConfidence
  };
}

export async function readLockedJourney(client: PoolClient, journeyId: string): Promise<LockedJourney> {
  const result = await client.query<{
    journey_id: string;
    booking_id: string;
    journey_status: JourneyStatus;
    journey_version: string | number;
    booking_status: BookingStatus;
    booking_version: string | number;
    assignment_id: string;
    assignment_status: string;
    driver_profile_id: string;
    vehicle_id: string;
    journey_leg_id: string;
    journey_leg_status: string;
    pickup_snapshot_id: string;
    pickup_latitude: string | number;
    pickup_longitude: string | number;
    dropoff_snapshot_id: string;
    dropoff_latitude: string | number;
    dropoff_longitude: string | number;
    passenger_person_id: string;
  }>(
    `SELECT j.id AS journey_id, j.booking_id, j.status AS journey_status,
            j.aggregate_version AS journey_version, b.status AS booking_status,
            b.aggregate_version AS booking_version, da.id AS assignment_id,
            da.status AS assignment_status, da.driver_profile_id, da.vehicle_id,
            leg.id AS journey_leg_id, leg.status AS journey_leg_status,
            b.pickup_snapshot_id,
            ST_Y(pickup.point::geometry) AS pickup_latitude,
            ST_X(pickup.point::geometry) AS pickup_longitude,
            b.dropoff_snapshot_id,
            ST_Y(dropoff.point::geometry) AS dropoff_latitude,
            ST_X(dropoff.point::geometry) AS dropoff_longitude,
            passenger.person_id AS passenger_person_id
       FROM journey.journey j
       JOIN booking.booking b ON b.id = j.booking_id
       JOIN booking.location_snapshot pickup ON pickup.id = b.pickup_snapshot_id
       JOIN booking.location_snapshot dropoff ON dropoff.id = b.dropoff_snapshot_id
       JOIN dispatch.driver_assignment da ON da.id = j.active_assignment_id
       JOIN journey.journey_leg leg ON leg.journey_id = j.id AND leg.driver_assignment_id = da.id
       JOIN LATERAL (
         SELECT bp.person_id FROM booking.booking_party bp
          WHERE bp.booking_id = b.id AND bp.role = 'PASSENGER' AND bp.person_id IS NOT NULL
          ORDER BY bp.created_at ASC LIMIT 1
       ) passenger ON true
      WHERE j.id = $1
      FOR UPDATE OF j, b, da, leg`,
    [journeyId]
  );
  if (!result.rowCount) throw new JourneyNotFoundError('Journey not found');
  const row = result.rows[0]!;
  return {
    journeyId: row.journey_id,
    bookingId: row.booking_id,
    journeyStatus: row.journey_status,
    journeyVersion: Number(row.journey_version),
    bookingStatus: row.booking_status,
    bookingVersion: Number(row.booking_version),
    assignmentId: row.assignment_id,
    assignmentStatus: row.assignment_status,
    driverProfileId: row.driver_profile_id,
    vehicleId: row.vehicle_id,
    journeyLegId: row.journey_leg_id,
    journeyLegStatus: row.journey_leg_status,
    pickupSnapshotId: row.pickup_snapshot_id,
    pickupLatitude: Number(row.pickup_latitude),
    pickupLongitude: Number(row.pickup_longitude),
    dropoffSnapshotId: row.dropoff_snapshot_id,
    dropoffLatitude: Number(row.dropoff_latitude),
    dropoffLongitude: Number(row.dropoff_longitude),
    passengerPersonId: row.passenger_person_id
  };
}

export function assertAssignedDriver(journey: LockedJourney, actor: AuthenticatedPrincipal): void {
  if (!actor.driverProfileId || actor.driverProfileId !== journey.driverProfileId) {
    throw new JourneyForbiddenError('Journey belongs to another Driver');
  }
  if (journey.assignmentStatus !== 'ACTIVE') throw new JourneyConflictError('Driver assignment is not active');
}

export async function assertJourneyParty(
  client: Pick<PoolClient, 'query'>,
  bookingId: string,
  actor: AuthenticatedPrincipal
): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM booking.booking_party
      WHERE booking_id = $1 AND person_id = $2
        AND role IN ('BOOKER','PASSENGER')
      LIMIT 1`,
    [bookingId, actor.personId]
  );
  if (!result.rowCount) throw new JourneyForbiddenError('Journey is not available to this actor');
}

async function assertSelfBookerPassenger(
  client: Pick<PoolClient, 'query'>,
  bookingId: string,
  actor: AuthenticatedPrincipal
): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM booking.booking_party passenger
      WHERE passenger.booking_id = $1 AND passenger.person_id = $2 AND passenger.role = 'PASSENGER'
        AND EXISTS (
          SELECT 1 FROM booking.booking_party booker
           WHERE booker.booking_id = passenger.booking_id
             AND booker.person_id = passenger.person_id
             AND booker.role = 'BOOKER'
        )
      LIMIT 1`,
    [bookingId, actor.personId]
  );
  if (!result.rowCount) throw new JourneyForbiddenError('Phase 0.5 PIN RideCheck requires the self-booking passenger');
}

export async function appendBookingTransition(
  client: PoolClient,
  journey: LockedJourney,
  to: BookingStatus,
  actor: AuthenticatedPrincipal,
  reasonCode: string,
  correlationId: string,
  commandId: string
): Promise<number> {
  assertCanonicalForwardTransition(journey.bookingStatus, to);
  const nextVersion = journey.bookingVersion + 1;
  await client.query(
    `UPDATE booking.booking SET status = $2::booking.booking_status, aggregate_version = $3, updated_at = now()
      WHERE id = $1`,
    [journey.bookingId, to, nextVersion]
  );
  await client.query(
    `INSERT INTO booking.booking_state_transition
       (booking_id, from_status, to_status, aggregate_version, command_id, actor_type, actor_id, reason_code)
     VALUES ($1,$2::booking.booking_status,$3::booking.booking_status,$4,$5,'ACCOUNT',$6,$7)`,
    [journey.bookingId, journey.bookingStatus, to, nextVersion, commandId, actor.accountId, reasonCode]
  );
  await client.query(
    `INSERT INTO booking.outbox_message
       (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
     VALUES ('Booking',$1,$2,$3,$4,$5,$6::jsonb)`,
    [journey.bookingId, nextVersion, `booking.${to.toLowerCase()}`, correlationId, commandId,
      JSON.stringify({ bookingId: journey.bookingId, from: journey.bookingStatus, to, aggregateVersion: nextVersion })]
  );
  return nextVersion;
}

const legStatusForJourney: Readonly<Record<JourneyStatus, string>> = {
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  AWAITING_RIDECHECK: 'ARRIVED',
  PASSENGER_VERIFIED: 'READY_TO_START',
  IN_PROGRESS: 'IN_PROGRESS',
  ARRIVING: 'ARRIVING',
  COMPLETED: 'COMPLETED'
};

export async function appendJourneyTransition(
  client: PoolClient,
  journey: LockedJourney,
  to: JourneyStatus,
  actor: AuthenticatedPrincipal,
  reasonCode: string,
  evidence: Readonly<Record<string, unknown>>,
  correlationId: string,
  commandId: string
): Promise<number> {
  assertJourneyTransition(journey.journeyStatus, to);
  const nextVersion = journey.journeyVersion + 1;
  await client.query(
    `UPDATE journey.journey
        SET status = $2::journey.journey_status, aggregate_version = $3, updated_at = now(),
            started_at = CASE WHEN $2 = 'IN_PROGRESS' THEN now() ELSE started_at END,
            completed_at = CASE WHEN $2 = 'COMPLETED' THEN now() ELSE completed_at END
      WHERE id = $1`,
    [journey.journeyId, to, nextVersion]
  );
  await client.query(
    `UPDATE journey.journey_leg
        SET status = $2::journey.journey_leg_status,
            started_at = CASE WHEN $2 = 'IN_PROGRESS' THEN now() ELSE started_at END,
            ended_at = CASE WHEN $2 = 'COMPLETED' THEN now() ELSE ended_at END
      WHERE id = $1`,
    [journey.journeyLegId, legStatusForJourney[to]]
  );
  await client.query(
    `INSERT INTO journey.state_transition
       (journey_id, from_status, to_status, aggregate_version, command_id, actor_type, actor_id, reason_code, evidence)
     VALUES ($1,$2::journey.journey_status,$3::journey.journey_status,$4,$5,'ACCOUNT',$6,$7,$8::jsonb)`,
    [journey.journeyId, journey.journeyStatus, to, nextVersion, commandId, actor.accountId, reasonCode, JSON.stringify(evidence)]
  );
  await client.query(
    `INSERT INTO journey.outbox_message
       (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
     VALUES ('Journey',$1,$2,$3,$4,$5,$6::jsonb)`,
    [journey.journeyId, nextVersion, `journey.${to.toLowerCase()}`, correlationId, commandId,
      JSON.stringify({ journeyId: journey.journeyId, bookingId: journey.bookingId, from: journey.journeyStatus, to, aggregateVersion: nextVersion })]
  );
  return nextVersion;
}

export async function latestLocation(client: Pick<PoolClient, 'query'>, journeyId: string): Promise<LocationRow | null> {
  const result = await client.query<LocationRow>(
    `SELECT id,
            ST_Y(point::geometry) AS latitude,
            ST_X(point::geometry) AS longitude,
            observed_at, received_at, accuracy_metres, confidence, telemetry_state,
            movement_plausible, movement_blocker
       FROM journey.driver_location_observation
      WHERE journey_id = $1
      ORDER BY observed_at DESC, received_at DESC
      LIMIT 1`,
    [journeyId]
  );
  return result.rows[0] ?? null;
}

function evaluatePickupLocation(location: LocationRow, journey: LockedJourney, now: Date, config: ApiConfig) {
  return evaluateArrivalEvidence({
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    observedAt: location.observed_at,
    receivedAt: now,
    accuracyMetres: Number(location.accuracy_metres),
    confidence: Number(location.confidence)
  }, {
    latitude: journey.pickupLatitude,
    longitude: journey.pickupLongitude
  }, {
    ...journeyLocationPolicy(config),
    arrivalRadiusMetres: config.journeyArrivalRadiusMetres
  });
}

async function readDedupe<T>(
  client: Pick<PoolClient, 'query'>,
  commandType: string,
  actorId: string,
  subjectId: string,
  idempotencyKey: string
): Promise<T | null> {
  const result = await client.query<{ response_body: T }>(
    `SELECT response_body FROM journey.command_deduplication
      WHERE command_type = $1 AND actor_id = $2 AND subject_id = $3 AND idempotency_key = $4`,
    [commandType, actorId, subjectId, idempotencyKey]
  );
  return result.rows[0]?.response_body ?? null;
}

async function writeDedupe(
  client: Pick<PoolClient, 'query'>,
  values: {
    readonly commandId: string;
    readonly commandType: string;
    readonly actorId: string;
    readonly subjectId: string;
    readonly idempotencyKey: string;
    readonly responseStatus: number;
    readonly response: unknown;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO journey.command_deduplication
       (command_id, idempotency_key, command_type, actor_id, subject_id, response_status, response_body)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [values.commandId, values.idempotencyKey, values.commandType, values.actorId, values.subjectId,
      values.responseStatus, JSON.stringify(values.response)]
  );
}

export async function acknowledgeDriverAssignment(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<DriverAcknowledgementResult> {
  if (!actor.driverProfileId) throw new JourneyForbiddenError('A Driver profile is required');
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const assignmentResult = await client.query<{
      assignment_id: string;
      driver_profile_id: string;
      booking_status: BookingStatus;
      booking_version: string | number;
    }>(
      `SELECT da.id AS assignment_id, da.driver_profile_id, b.status AS booking_status, b.aggregate_version AS booking_version
         FROM dispatch.driver_assignment da
         JOIN booking.booking b ON b.id = da.booking_id
        WHERE da.booking_id = $1 AND da.status = 'ACTIVE'
        FOR UPDATE OF da, b`,
      [bookingId]
    );
    if (!assignmentResult.rowCount) throw new JourneyNotFoundError('Active assignment not found');
    const duplicate = await readDedupe<DriverAcknowledgementResult>(client, 'AcknowledgeDriverAssignment', actor.accountId, bookingId, idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    const assignment = assignmentResult.rows[0]!;
    if (assignment.driver_profile_id !== actor.driverProfileId) throw new JourneyForbiddenError('Assignment belongs to another Driver');
    if (assignment.booking_status !== 'DRIVER_ASSIGNED') throw new JourneyConflictError(`Booking is ${assignment.booking_status}`);
    const already = await client.query<{ id: string }>('SELECT id FROM journey.journey WHERE booking_id = $1', [bookingId]);
    if (already.rowCount) throw new JourneyConflictError('Journey already exists for this Booking');

    const created = await client.query<{ id: string }>(
      `INSERT INTO journey.journey (booking_id, active_assignment_id, status, aggregate_version)
       VALUES ($1,$2,'ASSIGNED',1) RETURNING id`,
      [bookingId, assignment.assignment_id]
    );
    const journeyId = created.rows[0]!.id;
    const leg = await client.query<{ id: string }>(
      `INSERT INTO journey.journey_leg (journey_id, sequence_number, driver_assignment_id, status)
       VALUES ($1,1,$2,'ASSIGNED') RETURNING id`,
      [journeyId, assignment.assignment_id]
    );
    await client.query(
      `INSERT INTO journey.state_transition
         (journey_id, from_status, to_status, aggregate_version, command_id, actor_type, actor_id, reason_code)
       VALUES ($1,NULL,'ASSIGNED',1,$2,'ACCOUNT',$3,'ACTIVE_ASSIGNMENT_MATERIALISED')`,
      [journeyId, randomUUID(), actor.accountId]
    );
    const locked = await readLockedJourney(client, journeyId);
    const journeyVersion = await appendJourneyTransition(client, locked, 'EN_ROUTE', actor, 'DRIVER_ACKNOWLEDGED_ASSIGNMENT', { assignmentId: assignment.assignment_id }, correlationId, commandId);
    const bookingVersion = await appendBookingTransition(client, locked, 'DRIVER_EN_ROUTE', actor, 'DRIVER_ACKNOWLEDGED_ASSIGNMENT', correlationId, randomUUID());
    const response: DriverAcknowledgementResult = {
      journeyId,
      bookingId,
      bookingStatus: 'DRIVER_EN_ROUTE',
      journeyStatus: 'EN_ROUTE',
      aggregateVersion: journeyVersion,
      assignmentId: assignment.assignment_id,
      journeyLegId: leg.rows[0]!.id
    };
    await writeDedupe(client, { commandId: randomUUID(), commandType: 'AcknowledgeDriverAssignment', actorId: actor.accountId, subjectId: bookingId, idempotencyKey, responseStatus: 200, response });
    await client.query('COMMIT');
    void bookingVersion;
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordDriverLocationObservation(
  pool: DatabasePool,
  journeyId: string,
  request: DriverLocationObservationRequest,
  actor: AuthenticatedPrincipal,
  config: ApiConfig
): Promise<DriverLocationObservationResult> {
  if (!actor.driverProfileId) throw new JourneyForbiddenError('A Driver profile is required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await readLockedJourney(client, journeyId);
    assertAssignedDriver(locked, actor);
    if (!['EN_ROUTE', 'ARRIVED', 'AWAITING_RIDECHECK', 'PASSENGER_VERIFIED'].includes(locked.journeyStatus)) {
      throw new JourneyConflictError(`Pickup location ingestion is not allowed from ${locked.journeyStatus}`);
    }
    const existing = await client.query<{
      id: string; observed_at: Date; received_at: Date; telemetry_state: TelemetryConfidenceState; usable_for_critical_decision: boolean;
      latitude: string | number; longitude: string | number; source: string; accuracy_metres: string | number; confidence: string | number;
    }>(
      `SELECT id, observed_at, received_at, telemetry_state, usable_for_critical_decision,
              ST_Y(point::geometry) AS latitude, ST_X(point::geometry) AS longitude,
              source, accuracy_metres, confidence
         FROM journey.driver_location_observation
        WHERE journey_id = $1 AND client_observation_id = $2`,
      [journeyId, request.clientObservationId]
    );
    if (existing.rowCount) {
      const row = existing.rows[0]!;
      const samePayload = row.observed_at.getTime() === new Date(request.observedAt).getTime()
        && Number(row.latitude) === request.latitude
        && Number(row.longitude) === request.longitude
        && row.source === request.source
        && Number(row.accuracy_metres) === request.accuracyMetres
        && Number(row.confidence) === request.confidence;
      if (!samePayload) throw new JourneyConflictError('clientObservationId was reused with different location evidence');
      await client.query('COMMIT');
      return {
        observationId: row.id,
        journeyId,
        observedAt: row.observed_at.toISOString(),
        receivedAt: row.received_at.toISOString(),
        telemetryState: row.telemetry_state,
        usableForCriticalDecision: row.usable_for_critical_decision
      };
    }
    const observedAt = new Date(request.observedAt);
    if (Number.isNaN(observedAt.getTime())) throw new JourneyEvidenceError(['LOCATION_TIMESTAMP_INVALID']);
    const receivedAt = new Date();
    const decision = evaluateLocationEvidence({
      latitude: request.latitude,
      longitude: request.longitude,
      observedAt,
      receivedAt,
      accuracyMetres: request.accuracyMetres,
      confidence: request.confidence
    }, journeyLocationPolicy(config));
    const inserted = await client.query<{ id: string; received_at: Date }>(
      `INSERT INTO journey.driver_location_observation
         (journey_id, journey_leg_id, driver_profile_id, client_observation_id, point, observed_at, received_at,
          source, accuracy_metres, confidence, telemetry_state, usable_for_critical_decision)
       VALUES ($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,$7,$8,$9,$10,$11,$12::journey.telemetry_confidence_state,$13)
       RETURNING id, received_at`,
      [journeyId, locked.journeyLegId, actor.driverProfileId, request.clientObservationId,
        request.longitude, request.latitude, observedAt.toISOString(), receivedAt.toISOString(), request.source,
        request.accuracyMetres, request.confidence, decision.state, decision.usable]
    );
    await client.query('COMMIT');
    return {
      observationId: inserted.rows[0]!.id,
      journeyId,
      observedAt: observedAt.toISOString(),
      receivedAt: inserted.rows[0]!.received_at.toISOString(),
      telemetryState: decision.state,
      usableForCriticalDecision: decision.usable
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markDriverArrived(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<ArrivalResult> {
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const locked = await readLockedJourney(client, journeyId);
    const duplicate = await readDedupe<ArrivalResult>(client, 'MarkDriverArrived', actor.accountId, journeyId, idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    assertAssignedDriver(locked, actor);
    if (locked.journeyStatus !== 'EN_ROUTE' || locked.bookingStatus !== 'DRIVER_EN_ROUTE') {
      throw new JourneyConflictError(`Arrival requires EN_ROUTE; found ${locked.journeyStatus}/${locked.bookingStatus}`);
    }
    const location = await latestLocation(client, journeyId);
    if (!location) throw new JourneyEvidenceError(['LOCATION_MISSING']);
    const decision = evaluatePickupLocation(location, locked, new Date(), config);
    const blockers: string[] = [...decision.blockers];
    if (!decision.withinArrivalRadius) blockers.push('OUTSIDE_ARRIVAL_RADIUS');
    if (!decision.accepted) throw new JourneyEvidenceError(blockers);
    const evidence = await client.query<{ id: string }>(
      `INSERT INTO journey.arrival_evidence
         (journey_id, journey_leg_id, driver_location_observation_id, pickup_snapshot_id,
          distance_metres, permitted_radius_metres, accepted, policy_version)
       VALUES ($1,$2,$3,$4,$5,$6,true,'pickup-arrival-v0.5') RETURNING id`,
      [journeyId, locked.journeyLegId, location.id, locked.pickupSnapshotId, decision.distanceMetres, config.journeyArrivalRadiusMetres]
    );
    const journeyVersion = await appendJourneyTransition(client, locked, 'ARRIVED', actor, 'FRESH_GEOFENCED_ARRIVAL_ACCEPTED', {
      arrivalEvidenceId: evidence.rows[0]!.id,
      locationObservationId: location.id,
      distanceMetres: decision.distanceMetres,
      permittedRadiusMetres: config.journeyArrivalRadiusMetres
    }, correlationId, commandId);
    await appendBookingTransition(client, locked, 'DRIVER_ARRIVED', actor, 'FRESH_GEOFENCED_ARRIVAL_ACCEPTED', correlationId, randomUUID());
    const response: ArrivalResult = {
      journeyId,
      bookingId: locked.bookingId,
      bookingStatus: 'DRIVER_ARRIVED',
      journeyStatus: 'ARRIVED',
      aggregateVersion: journeyVersion,
      arrivalEvidenceId: evidence.rows[0]!.id,
      distanceMetres: decision.distanceMetres,
      arrivalRadiusMetres: config.journeyArrivalRadiusMetres
    };
    await writeDedupe(client, { commandId: randomUUID(), commandType: 'MarkDriverArrived', actorId: actor.accountId, subjectId: journeyId, idempotencyKey, responseStatus: 200, response });
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function startRideCheck(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<StartRideCheckResult> {
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const locked = await readLockedJourney(client, journeyId);
    const duplicate = await readDedupe<StartRideCheckResult>(client, 'StartRideCheck', actor.accountId, journeyId, idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    await assertSelfBookerPassenger(client, locked.bookingId, actor);
    if (locked.journeyStatus !== 'ARRIVED' || locked.bookingStatus !== 'DRIVER_ARRIVED') {
      throw new JourneyConflictError(`RideCheck requires ARRIVED; found ${locked.journeyStatus}/${locked.bookingStatus}`);
    }
    const hold = await client.query(`SELECT 1 FROM journey.operational_hold WHERE journey_id = $1 AND status = 'ACTIVE' LIMIT 1`, [journeyId]);
    if (hold.rowCount) throw new JourneyConflictError('Journey has an active operational or Safety hold');
    const sessionId = randomUUID();
    const challengeCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = createVerificationSalt();
    const verifier = hashVerificationCode(config.rideCheckPepper, sessionId, salt, challengeCode);
    const expiresAt = new Date(Date.now() + config.rideCheckTtlMinutes * 60_000);
    await client.query(
      `INSERT INTO journey.ridecheck_session
         (id, journey_id, journey_leg_id, driver_assignment_id, passenger_person_id, driver_profile_id,
          vehicle_id, method, status, challenge_salt, challenge_verifier, maximum_attempts, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PIN','PENDING',$8,$9,$10,$11)`,
      [sessionId, journeyId, locked.journeyLegId, locked.assignmentId, locked.passengerPersonId,
        locked.driverProfileId, locked.vehicleId, salt, verifier, config.rideCheckMaximumAttempts, expiresAt.toISOString()]
    );
    const journeyVersion = await appendJourneyTransition(client, locked, 'AWAITING_RIDECHECK', actor, 'RIDER_STARTED_PROTECTED_RIDECHECK', {
      rideCheckSessionId: sessionId,
      method: 'PIN'
    }, correlationId, commandId);
    await appendBookingTransition(client, locked, 'AWAITING_RIDECHECK', actor, 'RIDER_STARTED_PROTECTED_RIDECHECK', correlationId, randomUUID());
    const firstResponse: StartRideCheckResult = {
      journeyId,
      bookingId: locked.bookingId,
      bookingStatus: 'AWAITING_RIDECHECK',
      journeyStatus: 'AWAITING_RIDECHECK',
      aggregateVersion: journeyVersion,
      rideCheckSessionId: sessionId,
      method: 'PIN',
      expiresAt: expiresAt.toISOString(),
      challengeCode,
      challengeCodeReturnedOnce: true
    };
    const replaySafeResponse: StartRideCheckResult = {
      journeyId,
      bookingId: locked.bookingId,
      bookingStatus: 'AWAITING_RIDECHECK',
      journeyStatus: 'AWAITING_RIDECHECK',
      aggregateVersion: journeyVersion,
      rideCheckSessionId: sessionId,
      method: 'PIN',
      expiresAt: expiresAt.toISOString(),
      challengeCodeReturnedOnce: false
    };
    await writeDedupe(client, { commandId: randomUUID(), commandType: 'StartRideCheck', actorId: actor.accountId, subjectId: journeyId, idempotencyKey, responseStatus: 201, response: replaySafeResponse });
    await client.query('COMMIT');
    return firstResponse;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyRideCheck(
  pool: DatabasePool,
  journeyId: string,
  rideCheckSessionId: string,
  code: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<VerifyRideCheckResult> {
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const locked = await readLockedJourney(client, journeyId);
    const duplicate = await readDedupe<VerifyRideCheckResult>(client, 'VerifyRideCheck', actor.accountId, rideCheckSessionId, idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    assertAssignedDriver(locked, actor);
    if (locked.journeyStatus !== 'AWAITING_RIDECHECK' || locked.bookingStatus !== 'AWAITING_RIDECHECK') {
      throw new JourneyConflictError(`RideCheck verification requires AWAITING_RIDECHECK; found ${locked.journeyStatus}/${locked.bookingStatus}`);
    }
    const sessionResult = await client.query<{
      id: string; status: RideCheckStatus; challenge_salt: string; challenge_verifier: string;
      attempts_used: string | number; maximum_attempts: string | number; expires_at: Date;
      driver_profile_id: string; driver_assignment_id: string; vehicle_id: string;
    }>(
      `SELECT id, status, challenge_salt, challenge_verifier, attempts_used, maximum_attempts,
              expires_at, driver_profile_id, driver_assignment_id, vehicle_id
         FROM journey.ridecheck_session
        WHERE id = $1 AND journey_id = $2
        FOR UPDATE`,
      [rideCheckSessionId, journeyId]
    );
    if (!sessionResult.rowCount) throw new JourneyNotFoundError('RideCheck session not found');
    const session = sessionResult.rows[0]!;
    if (session.driver_profile_id !== actor.driverProfileId || session.driver_assignment_id !== locked.assignmentId || session.vehicle_id !== locked.vehicleId) {
      throw new JourneyForbiddenError('RideCheck identity pairing does not match the active assignment');
    }
    const actual = hashVerificationCode(config.rideCheckPepper, session.id, session.challenge_salt, code);
    const verifierMatches = constantTimeHexEqual(session.challenge_verifier, actual);
    const decision = evaluateRideCheckAttempt({
      status: session.status,
      verifierMatches,
      attemptsUsed: Number(session.attempts_used),
      maximumAttempts: Number(session.maximum_attempts),
      expiresAt: session.expires_at,
      now: new Date()
    });
    const attemptNumber = Number(session.attempts_used) + (session.status === 'PENDING' && decision.reason !== 'EXPIRED' ? 1 : 0);
    if (attemptNumber > Number(session.attempts_used)) {
      await client.query(
        `INSERT INTO journey.ridecheck_attempt
           (ridecheck_session_id, attempt_number, submitted_by_driver_profile_id, verifier_matched, result_status)
         VALUES ($1,$2,$3,$4,$5::journey.ridecheck_status)`,
        [session.id, attemptNumber, actor.driverProfileId, verifierMatches, decision.nextStatus]
      );
    }
    await client.query(
      `UPDATE journey.ridecheck_session
          SET status = $2::journey.ridecheck_status,
              attempts_used = $3,
              verified_at = CASE WHEN $2 = 'VERIFIED' THEN now() ELSE verified_at END,
              updated_at = now()
        WHERE id = $1`,
      [session.id, decision.nextStatus, attemptNumber]
    );

    let journeyStatus: string = locked.journeyStatus;
    let bookingStatus: string = locked.bookingStatus;
    if (decision.accepted) {
      await appendJourneyTransition(client, locked, 'PASSENGER_VERIFIED', actor, 'RIDECHECK_IDENTITY_PAIRING_VERIFIED', {
        rideCheckSessionId: session.id,
        assignmentId: locked.assignmentId,
        vehicleId: locked.vehicleId
      }, correlationId, commandId);
      await appendBookingTransition(client, locked, 'PASSENGER_VERIFIED', actor, 'RIDECHECK_IDENTITY_PAIRING_VERIFIED', correlationId, randomUUID());
      journeyStatus = 'PASSENGER_VERIFIED';
      bookingStatus = 'PASSENGER_VERIFIED';
    } else if (decision.reason === 'ATTEMPTS_EXHAUSTED') {
      const hold = await client.query<{ id: string }>(
        `INSERT INTO journey.operational_hold
           (journey_id, status, reason_code, source_type, source_id)
         VALUES ($1,'ACTIVE','RIDECHECK_ATTEMPTS_EXHAUSTED','RIDECHECK',$2)
         ON CONFLICT (journey_id, reason_code) WHERE status = 'ACTIVE'
         DO UPDATE SET source_id = EXCLUDED.source_id
         RETURNING id`,
        [journeyId, session.id]
      );
      await client.query(
        `INSERT INTO journey.operational_hold_transition
           (operational_hold_id, from_status, to_status, actor_type, actor_id, reason_code)
         VALUES ($1,NULL,'ACTIVE','SYSTEM',NULL,'RIDECHECK_PROTECTED_START')`,
        [hold.rows[0]!.id]
      );
      const safety = await client.query<{ id: string }>(
        `INSERT INTO safety.safety_event
           (journey_id, trigger_type, severity, status, finding_status, source_reference)
         VALUES ($1,'RIDECHECK_MISMATCH','ATTENTION','OPEN','NOT_ASSESSED',$2)
         RETURNING id`,
        [journeyId, session.id]
      );
      await client.query(
        `INSERT INTO safety.safety_event_transition
           (safety_event_id, from_status, to_status, actor_type, actor_id, reason_code)
         VALUES ($1,NULL,'OPEN','SYSTEM',NULL,'RIDECHECK_ATTEMPTS_EXHAUSTED')`,
        [safety.rows[0]!.id]
      );
      await client.query(
        `INSERT INTO journey.outbox_message
           (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
         VALUES ('Journey',$1,$2,'safety.ridecheck.intervention_required',$3,$4,$5::jsonb)`,
        [journeyId, locked.journeyVersion, correlationId, commandId,
          JSON.stringify({ journeyId, rideCheckSessionId: session.id, safetyEventId: safety.rows[0]!.id, misconductFinding: false })]
      );
    }

    const response: VerifyRideCheckResult = {
      journeyId,
      rideCheckSessionId: session.id,
      verified: decision.accepted,
      status: decision.nextStatus === 'SUPERSEDED' ? 'LOCKED' : decision.nextStatus,
      attemptsRemaining: decision.attemptsRemaining,
      journeyStatus,
      bookingStatus,
      mismatchCreatesMisconductFinding: false
    };
    await writeDedupe(client, { commandId: randomUUID(), commandType: 'VerifyRideCheck', actorId: actor.accountId, subjectId: session.id, idempotencyKey, responseStatus: decision.accepted ? 200 : 409, response });
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function assignmentStillEligible(client: Pick<PoolClient, 'query'>, journey: LockedJourney): Promise<boolean> {
  const result = await client.query<{ eligible: boolean }>(
    `SELECT (
       da.status = 'ACTIVE'
       AND dp.onboarding_status = 'APPROVED'
       AND ua.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1 FROM driver.driver_vehicle_authorisation dva
          WHERE dva.driver_profile_id = da.driver_profile_id AND dva.vehicle_id = da.vehicle_id
            AND dva.status = 'ACTIVE' AND dva.valid_from <= now()
            AND (dva.valid_until IS NULL OR dva.valid_until > now())
       )
       AND (SELECT des.status = 'ELIGIBLE' AND des.valid_until > now()
              FROM compliance.driver_eligibility_snapshot des
             WHERE des.driver_profile_id = da.driver_profile_id
             ORDER BY des.evaluated_at DESC LIMIT 1)
       AND (SELECT ves.status = 'ELIGIBLE' AND ves.valid_until > now()
              FROM compliance.vehicle_eligibility_snapshot ves
             WHERE ves.vehicle_id = da.vehicle_id
             ORDER BY ves.evaluated_at DESC LIMIT 1)
       AND (SELECT maintenance.operating_permitted
              FROM vehicle_fleet.current_vehicle_maintenance_gate maintenance
             WHERE maintenance.vehicle_id = da.vehicle_id)
     ) IS TRUE AS eligible
       FROM dispatch.driver_assignment da
       JOIN driver.driver_profile dp ON dp.id = da.driver_profile_id
       JOIN identity.user_account ua ON ua.person_id = dp.person_id
      WHERE da.id = $1`,
    [journey.assignmentId]
  );
  if (result.rows[0]?.eligible !== true) return false;
  const context = await client.query<{
    service_capabilities: Record<string, unknown>;
    requirements: { type: string; value: unknown }[];
    restricted_service_codes: string[];
  }>(
    `SELECT ves.service_capabilities, maintenance.restricted_service_codes,
            COALESCE(jsonb_agg(jsonb_build_object('type', br.requirement_type, 'value', br.requirement_value))
              FILTER (WHERE br.id IS NOT NULL), '[]'::jsonb) AS requirements
       FROM dispatch.driver_assignment da
       JOIN LATERAL (
         SELECT snapshot.service_capabilities
           FROM compliance.vehicle_eligibility_snapshot snapshot
          WHERE snapshot.vehicle_id = da.vehicle_id
          ORDER BY snapshot.evaluated_at DESC LIMIT 1
       ) ves ON true
       JOIN vehicle_fleet.current_vehicle_maintenance_gate maintenance ON maintenance.vehicle_id = da.vehicle_id
       LEFT JOIN booking.booking_requirement br ON br.booking_id = da.booking_id
      WHERE da.id = $1
      GROUP BY ves.service_capabilities, maintenance.restricted_service_codes`,
    [journey.assignmentId]
  );
  const row = context.rows[0];
  if (!row) return false;
  const requiredServices = new Set<string>();
  const requirementTypes = row.requirements.map((requirement) => requirement.type.trim().toUpperCase());
  if (requirementTypes.some((type) => type.includes('SCHOOL'))) requiredServices.add('SCHOOL');
  if (requirementTypes.some((type) => type.includes('WAV') || type.includes('WHEELCHAIR'))) requiredServices.add('WAV');
  if (requirementTypes.some((type) => type.includes('HOSPITAL'))) requiredServices.add('HOSPITAL');
  if (requirementTypes.some((type) => type.includes('SPECIALIST') || type.includes('HANDOVER'))) requiredServices.add('SPECIALIST');
  if (!requiredServices.size) requiredServices.add('STANDARD');
  if (row.restricted_service_codes.some((serviceCode) => requiredServices.has(serviceCode))) return false;
  return row.requirements.every((requirement) => {
    const actual = row.service_capabilities[requirement.type];
    if (actual === undefined) return false;
    if (typeof actual !== 'object' || actual === null) return actual === requirement.value || actual === true;
    if (typeof requirement.value !== 'object' || requirement.value === null) return actual === requirement.value;
    return Object.entries(requirement.value).every(([key, expected]) => (
      (actual as Record<string, unknown>)[key] === expected
    ));
  });
}

export async function startJourney(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<JourneyCommandResult> {
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const locked = await readLockedJourney(client, journeyId);
    const duplicate = await readDedupe<JourneyCommandResult>(client, 'StartJourney', actor.accountId, journeyId, idempotencyKey);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    assertAssignedDriver(locked, actor);
    const rideCheck = await client.query<{ id: string; status: RideCheckStatus }>(
      `SELECT id, status FROM journey.ridecheck_session
        WHERE journey_id = $1 AND journey_leg_id = $2
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [journeyId, locked.journeyLegId]
    );
    const hold = await client.query(`SELECT 1 FROM journey.operational_hold WHERE journey_id = $1 AND status = 'ACTIVE' LIMIT 1`, [journeyId]);
    const arrivalEvidence = await client.query(
      `SELECT 1 FROM journey.arrival_evidence
        WHERE journey_id = $1 AND journey_leg_id = $2 AND accepted = true LIMIT 1`,
      [journeyId, locked.journeyLegId]
    );
    const eligible = await assignmentStillEligible(client, locked);
    const location = await latestLocation(client, journeyId);
    const pickupDecision = location ? evaluatePickupLocation(location, locked, new Date(), config) : null;
    const allowed = canStartJourney({
      journeyStatus: locked.journeyStatus,
      rideCheckStatus: rideCheck.rows[0]?.status ?? null,
      assignmentActive: locked.assignmentStatus === 'ACTIVE',
      assignmentStillEligible: eligible,
      activeOperationalHold: Boolean(hold.rowCount),
      pickupEvidenceAccepted: pickupDecision?.accepted === true && Boolean(arrivalEvidence.rowCount)
    });
    if (!allowed) {
      const blockers: string[] = [];
      if (locked.journeyStatus !== 'PASSENGER_VERIFIED') blockers.push('PASSENGER_NOT_VERIFIED');
      if (rideCheck.rows[0]?.status !== 'VERIFIED') blockers.push('RIDECHECK_NOT_VERIFIED');
      if (locked.assignmentStatus !== 'ACTIVE') blockers.push('ASSIGNMENT_NOT_ACTIVE');
      if (!eligible) blockers.push('ASSIGNMENT_ELIGIBILITY_CHANGED');
      if (hold.rowCount) blockers.push('ACTIVE_OPERATIONAL_OR_SAFETY_HOLD');
      if (!arrivalEvidence.rowCount) blockers.push('ARRIVAL_EVIDENCE_MISSING');
      if (!location) blockers.push('LOCATION_MISSING');
      else if (!pickupDecision?.accepted) {
        blockers.push(...(pickupDecision?.blockers ?? []));
        if (!pickupDecision?.withinArrivalRadius) blockers.push('OUTSIDE_PICKUP_START_RADIUS');
      }
      throw new JourneyEvidenceError([...new Set(blockers)]);
    }
    const journeyVersion = await appendJourneyTransition(client, locked, 'IN_PROGRESS', actor, 'PROTECTED_JOURNEY_START_VALIDATED', {
      rideCheckSessionId: rideCheck.rows[0]!.id,
      assignmentId: locked.assignmentId,
      locationObservationId: location!.id,
      distanceMetres: pickupDecision!.distanceMetres,
      assignmentEligibilityRevalidated: true,
      activeHold: false
    }, correlationId, commandId);
    await appendBookingTransition(client, locked, 'IN_PROGRESS', actor, 'PROTECTED_JOURNEY_START_VALIDATED', correlationId, randomUUID());
    const response: JourneyCommandResult = {
      journeyId,
      bookingId: locked.bookingId,
      bookingStatus: 'IN_PROGRESS',
      journeyStatus: 'IN_PROGRESS',
      aggregateVersion: journeyVersion
    };
    await writeDedupe(client, { commandId: randomUUID(), commandType: 'StartJourney', actorId: actor.accountId, subjectId: journeyId, idempotencyKey, responseStatus: 200, response });
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getJourneyLiveProjection(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  config: ApiConfig
): Promise<JourneyLiveProjection> {
  const result = await pool.query<{
    journey_id: string; booking_id: string; journey_status: string; booking_status: string;
    aggregate_version: string | number; assignment_id: string; driver_profile_id: string; vehicle_id: string;
    ridecheck_session_id: string | null; ridecheck_status: string | null; active_hold: boolean;
    location_latitude: string | number | null; location_longitude: string | number | null;
    location_observed_at: Date | null; location_received_at: Date | null;
    location_accuracy_metres: string | number | null; location_confidence: string | number | null;
    location_persisted_telemetry_state: TelemetryConfidenceState | null;
    location_movement_plausible: boolean | null;
  }>(
    `SELECT j.id AS journey_id, j.booking_id, j.status AS journey_status, b.status AS booking_status,
            j.aggregate_version, da.id AS assignment_id, da.driver_profile_id, da.vehicle_id,
            rc.id AS ridecheck_session_id, rc.status AS ridecheck_status,
            EXISTS (SELECT 1 FROM journey.operational_hold h WHERE h.journey_id = j.id AND h.status = 'ACTIVE') AS active_hold,
            ST_Y(location.point::geometry) AS location_latitude,
            ST_X(location.point::geometry) AS location_longitude,
            location.observed_at AS location_observed_at, location.received_at AS location_received_at,
            location.accuracy_metres AS location_accuracy_metres, location.confidence AS location_confidence,
            location.telemetry_state AS location_persisted_telemetry_state,
            location.movement_plausible AS location_movement_plausible
       FROM journey.journey j
       JOIN booking.booking b ON b.id = j.booking_id
       JOIN dispatch.driver_assignment da ON da.id = j.active_assignment_id
       LEFT JOIN LATERAL (
         SELECT session.id, session.status FROM journey.ridecheck_session session
          WHERE session.journey_id = j.id ORDER BY session.created_at DESC LIMIT 1
       ) rc ON true
       LEFT JOIN LATERAL (
         SELECT observation.point, observation.observed_at, observation.received_at,
                observation.accuracy_metres, observation.confidence, observation.telemetry_state,
                observation.movement_plausible
           FROM journey.driver_location_observation observation
          WHERE observation.journey_id = j.id
          ORDER BY observation.observed_at DESC, observation.received_at DESC LIMIT 1
       ) location ON true
      WHERE j.id = $1`,
    [journeyId]
  );
  if (!result.rowCount) throw new JourneyNotFoundError('Journey not found');
  const row = result.rows[0]!;
  const assignedDriver = actor.driverProfileId === row.driver_profile_id;
  if (!assignedDriver) await assertJourneyParty(pool, row.booking_id, actor);
  let currentTelemetryState: TelemetryConfidenceState | undefined;
  if (row.location_observed_at && row.location_accuracy_metres !== null && row.location_confidence !== null) {
    const readTimeTelemetry = evaluateLocationEvidence({
      latitude: Number(row.location_latitude), longitude: Number(row.location_longitude),
      observedAt: row.location_observed_at, receivedAt: new Date(),
      accuracyMetres: Number(row.location_accuracy_metres), confidence: Number(row.location_confidence)
    }, journeyLocationPolicy(config)).state;
    currentTelemetryState = readTimeTelemetry === 'STALE' || row.location_persisted_telemetry_state === 'STALE'
      ? 'STALE'
      : row.location_movement_plausible === false || row.location_persisted_telemetry_state === 'DEGRADED'
        ? 'DEGRADED'
        : readTimeTelemetry;
  }
  return {
    journeyId: row.journey_id,
    bookingId: row.booking_id,
    journeyStatus: row.journey_status,
    bookingStatus: row.booking_status,
    aggregateVersion: Number(row.aggregate_version),
    assignmentId: row.assignment_id,
    driverProfileId: row.driver_profile_id,
    vehicleId: row.vehicle_id,
    ...(row.ridecheck_status ? { rideCheckStatus: row.ridecheck_status } : {}),
    ...(row.ridecheck_session_id ? { rideCheckSessionId: row.ridecheck_session_id } : {}),
    activeOperationalHold: row.active_hold,
    ...(row.location_observed_at && row.location_received_at && currentTelemetryState ? {
      latestDriverLocation: {
        latitude: Number(row.location_latitude),
        longitude: Number(row.location_longitude),
        observedAt: row.location_observed_at.toISOString(),
        receivedAt: row.location_received_at.toISOString(),
        telemetryState: currentTelemetryState,
        accuracyMetres: Number(row.location_accuracy_metres)
      }
    } : {}),
    projectionGeneratedAt: new Date().toISOString(),
    requiresAuthoritativeRefreshBeforeMutation: true
  };
}

export async function getJourneyLiveProjectionByBooking(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal,
  config: ApiConfig
): Promise<JourneyLiveProjection> {
  const result = await pool.query<{ id: string }>('SELECT id FROM journey.journey WHERE booking_id = $1', [bookingId]);
  if (!result.rowCount) throw new JourneyNotFoundError('Journey not yet created for Booking');
  return getJourneyLiveProjection(pool, result.rows[0]!.id, actor, config);
}
