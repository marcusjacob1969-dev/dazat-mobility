import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  canReleaseDriverAfterJourneyCompletion,
  evaluateDestinationEvidence,
  evaluateJourneyCompletion,
  evaluateLocationEvidence,
  evaluateMovementPlausibility,
  type MovementPlausibilityDecision,
  type TelemetryConfidenceState
} from '@dazat/domain';
import type {
  ActiveJourneyLocationRequest,
  ActiveJourneyLocationResult,
  ActiveJourneyProjection,
  CompleteJourneyResult,
  MarkArrivingResult,
  RouteChangeRequest,
  RouteChangeResult
} from '@dazat/contracts';
import type { ApiConfig } from '../../config.js';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import {
  appendBookingTransition,
  appendJourneyTransition,
  assertAssignedDriver,
  assertJourneyParty,
  getJourneyLiveProjection,
  journeyLocationPolicy,
  JourneyConflictError,
  JourneyEvidenceError,
  readLockedJourney,
  type LockedJourney,
  type LocationRow
} from './journey-service.js';

interface CompletionRequirements {
  readonly serviceContext: 'STANDARD' | 'SCHOOL' | 'HOSPITAL' | 'SPECIALIST';
  readonly handoverRequired: boolean;
  readonly sourceRequirementIds: readonly string[];
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

async function readJourneyCommand<T>(
  client: Pick<PoolClient, 'query'>,
  commandType: string,
  actorId: string,
  subjectId: string,
  key: string,
  requestFingerprint: string
): Promise<T | null> {
  const result = await client.query<{ response_body: T; request_fingerprint: string | null }>(
    `SELECT response_body, request_fingerprint
       FROM journey.command_deduplication
      WHERE command_type = $1 AND actor_id = $2 AND subject_id = $3 AND idempotency_key = $4`,
    [commandType, actorId, subjectId, key]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.request_fingerprint && row.request_fingerprint !== requestFingerprint) {
    throw new JourneyConflictError('Idempotency key was reused with a materially different request');
  }
  return row.response_body;
}

async function writeJourneyCommand(
  client: Pick<PoolClient, 'query'>,
  input: {
    readonly commandType: string;
    readonly actorId: string;
    readonly subjectId: string;
    readonly key: string;
    readonly requestFingerprint: string;
    readonly response: unknown;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO journey.command_deduplication
       (command_id, idempotency_key, command_type, actor_id, subject_id, response_status, response_body, request_fingerprint)
     VALUES ($1,$2,$3,$4,$5,200,$6::jsonb,$7)`,
    [randomUUID(), input.key, input.commandType, input.actorId, input.subjectId, JSON.stringify(input.response), input.requestFingerprint]
  );
}

async function appendJourneyEvent(
  client: Pick<PoolClient, 'query'>,
  input: {
    readonly journeyId: string;
    readonly eventType: string;
    readonly actorType: string;
    readonly actorId?: string;
    readonly commandId?: string;
    readonly correlationId?: string;
    readonly classification?: 'CONFIDENTIAL' | 'RESTRICTED' | 'HIGHLY_RESTRICTED';
    readonly payload: Readonly<Record<string, unknown>>;
  }
): Promise<number> {
  const sequence = await client.query<{ next_sequence: string | number }>(
    `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
       FROM journey.journey_event WHERE journey_id = $1`,
    [input.journeyId]
  );
  const next = Number(sequence.rows[0]!.next_sequence);
  await client.query(
    `INSERT INTO journey.journey_event
       (journey_id, sequence_number, event_type, actor_type, actor_id, command_id, correlation_id, classification, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [input.journeyId, next, input.eventType, input.actorType, input.actorId ?? null,
      input.commandId ?? null, input.correlationId ?? null, input.classification ?? 'CONFIDENTIAL', JSON.stringify(input.payload)]
  );
  return next;
}

function sameLocationPayload(row: LocationRow & { source: string }, request: ActiveJourneyLocationRequest): boolean {
  return row.observed_at.getTime() === new Date(request.observedAt).getTime()
    && Number(row.latitude) === request.latitude
    && Number(row.longitude) === request.longitude
    && row.source === request.source
    && Number(row.accuracy_metres) === request.accuracyMetres
    && Number(row.confidence) === request.confidence;
}

async function latestPlausibleLocation(client: Pick<PoolClient, 'query'>, journeyId: string): Promise<LocationRow | null> {
  const result = await client.query<LocationRow>(
    `SELECT id, ST_Y(point::geometry) AS latitude, ST_X(point::geometry) AS longitude,
            observed_at, received_at, accuracy_metres, confidence, telemetry_state,
            movement_plausible, movement_blocker
       FROM journey.driver_location_observation
      WHERE journey_id = $1 AND movement_plausible = true
      ORDER BY observed_at DESC, received_at DESC LIMIT 1`,
    [journeyId]
  );
  return result.rows[0] ?? null;
}

export async function recordActiveJourneyLocation(
  pool: DatabasePool,
  journeyId: string,
  request: ActiveJourneyLocationRequest,
  actor: AuthenticatedPrincipal,
  config: ApiConfig
): Promise<ActiveJourneyLocationResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journey = await readLockedJourney(client, journeyId);
    assertAssignedDriver(journey, actor);
    if (!['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus)) {
      throw new JourneyConflictError(`Active Journey telemetry is not accepted from ${journey.journeyStatus}`);
    }
    const existing = await client.query<LocationRow & { source: string }>(
      `SELECT id, ST_Y(point::geometry) AS latitude, ST_X(point::geometry) AS longitude,
              observed_at, received_at, accuracy_metres, confidence, telemetry_state,
              movement_plausible, movement_blocker, source
         FROM journey.driver_location_observation
        WHERE journey_id = $1 AND client_observation_id = $2`,
      [journeyId, request.clientObservationId]
    );
    if (existing.rowCount) {
      const row = existing.rows[0]!;
      if (!sameLocationPayload(row, request)) {
        throw new JourneyConflictError('clientObservationId was reused with different active Journey telemetry');
      }
      await client.query('COMMIT');
      return {
        observationId: row.id,
        journeyId,
        observedAt: row.observed_at.toISOString(),
        receivedAt: row.received_at.toISOString(),
        telemetryState: row.telemetry_state,
        usableForMonitoring: row.telemetry_state === 'LIVE' || row.telemetry_state === 'DELAYED',
        movementPlausible: row.movement_plausible,
        ...(row.movement_blocker ? { movementBlocker: row.movement_blocker as 'OUT_OF_ORDER_LOCATION' | 'IMPOSSIBLE_JUMP' } : {})
      };
    }
    const observedAt = new Date(request.observedAt);
    if (Number.isNaN(observedAt.getTime())) throw new JourneyEvidenceError(['LOCATION_TIMESTAMP_INVALID']);
    const receivedAt = new Date();
    const telemetry = evaluateLocationEvidence({
      latitude: request.latitude, longitude: request.longitude, observedAt, receivedAt,
      accuracyMetres: request.accuracyMetres, confidence: request.confidence
    }, journeyLocationPolicy(config));
    const previous = await latestPlausibleLocation(client, journeyId);
    const movement: MovementPlausibilityDecision = previous ? evaluateMovementPlausibility({
      latitude: Number(previous.latitude), longitude: Number(previous.longitude), observedAt: previous.observed_at
    }, {
      latitude: request.latitude, longitude: request.longitude, observedAt
    }, config.activeJourneyMaximumPlausibleSpeedMetresPerSecond) : {
      plausible: true, distanceMetres: 0, elapsedSeconds: 0, impliedSpeedMetresPerSecond: null
    };
    const usable = telemetry.usable && movement.plausible;
    const telemetryState: TelemetryConfidenceState = telemetry.state === 'STALE'
      ? 'STALE'
      : movement.plausible ? telemetry.state : 'DEGRADED';
    const inserted = await client.query<{ id: string; received_at: Date }>(
      `INSERT INTO journey.driver_location_observation
         (journey_id, journey_leg_id, driver_profile_id, client_observation_id, point,
          observed_at, received_at, source, purpose, accuracy_metres, confidence,
          telemetry_state, usable_for_critical_decision, movement_plausible, movement_blocker,
          implied_speed_metres_per_second)
       VALUES ($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,
               $7,$8,$9,'ACTIVE_JOURNEY',$10,$11,$12::journey.telemetry_confidence_state,
               $13,$14,$15,$16)
       RETURNING id, received_at`,
      [journeyId, journey.journeyLegId, actor.driverProfileId, request.clientObservationId,
        request.longitude, request.latitude, observedAt.toISOString(), receivedAt.toISOString(), request.source,
        request.accuracyMetres, request.confidence, telemetryState, usable, movement.plausible,
        movement.blocker ?? null, movement.impliedSpeedMetresPerSecond]
    );
    if (!usable) {
      await appendJourneyEvent(client, {
        journeyId,
        eventType: 'telemetry.location-degraded',
        actorType: 'SYSTEM',
        classification: 'RESTRICTED',
        payload: {
          observationId: inserted.rows[0]!.id,
          telemetryState,
          telemetryBlockers: telemetry.blockers,
          movementBlocker: movement.blocker ?? null,
          misconductFinding: false
        }
      });
    }
    await client.query('COMMIT');
    return {
      observationId: inserted.rows[0]!.id,
      journeyId,
      observedAt: observedAt.toISOString(),
      receivedAt: inserted.rows[0]!.received_at.toISOString(),
      telemetryState,
      usableForMonitoring: usable,
      movementPlausible: movement.plausible,
      ...(movement.blocker ? { movementBlocker: movement.blocker } : {})
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function latestActiveLocation(client: Pick<PoolClient, 'query'>, journeyId: string): Promise<LocationRow | null> {
  const result = await client.query<LocationRow>(
    `SELECT id, ST_Y(point::geometry) AS latitude, ST_X(point::geometry) AS longitude,
            observed_at, received_at, accuracy_metres, confidence, telemetry_state,
            movement_plausible, movement_blocker
       FROM journey.driver_location_observation
      WHERE journey_id = $1 AND purpose = 'ACTIVE_JOURNEY' AND movement_plausible = true
      ORDER BY observed_at DESC, received_at DESC LIMIT 1`,
    [journeyId]
  );
  return result.rows[0] ?? null;
}

function validateLocation(location: RouteChangeRequest['location']): void {
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) throw new JourneyEvidenceError(['LATITUDE_INVALID']);
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) throw new JourneyEvidenceError(['LONGITUDE_INVALID']);
  if (!location.displayLabel.trim() || location.displayLabel.trim().length > 500) throw new JourneyEvidenceError(['DISPLAY_LABEL_INVALID']);
}

async function insertLocationSnapshot(client: Pick<PoolClient, 'query'>, location: RouteChangeRequest['location']): Promise<string> {
  validateLocation(location);
  const result = await client.query<{ id: string }>(
    `INSERT INTO booking.location_snapshot (point, display_label, structured_address, provider_reference)
     VALUES (ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3,$4::jsonb,$5) RETURNING id`,
    [location.longitude, location.latitude, location.displayLabel.trim(),
      JSON.stringify(location.structuredAddress ?? {}), location.providerReference ?? null]
  );
  return result.rows[0]!.id;
}

export async function requestRouteChange(
  pool: DatabasePool,
  journeyId: string,
  request: RouteChangeRequest,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<RouteChangeResult> {
  const client = await pool.connect();
  const requestFingerprint = fingerprint(request);
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const journey = await readLockedJourney(client, journeyId);
    const duplicate = await readJourneyCommand<RouteChangeResult>(client, 'RequestRouteChange', actor.accountId, journeyId, idempotencyKey, requestFingerprint);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    await assertJourneyParty(client, journey.bookingId, actor);
    if (!['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus)) throw new JourneyConflictError('Route change requires an active Journey');
    if (request.expectedJourneyVersion !== journey.journeyVersion) {
      throw new JourneyConflictError(`Expected Journey version ${request.expectedJourneyVersion}; found ${journey.journeyVersion}`);
    }
    const snapshotId = await insertLocationSnapshot(client, request.location);
    const routeChange = await client.query<{ id: string }>(
      `INSERT INTO journey.route_change_request
         (journey_id, request_type, requested_location_snapshot_id, requested_by_person_id,
          expected_journey_version, status, reason_code, pricing_status, driver_acknowledgement_status)
       VALUES ($1,$2,$3,$4,$5,'PENDING_POLICY_REVIEW',$6,'NOT_EVALUATED','NOT_REQUESTED') RETURNING id`,
      [journeyId, request.requestType, snapshotId, actor.personId, request.expectedJourneyVersion, request.reasonCode]
    );
    await client.query(
      `INSERT INTO journey.route_change_transition
         (route_change_request_id, from_status, to_status, actor_type, actor_id, reason_code)
       VALUES ($1,NULL,'PENDING_POLICY_REVIEW','ACCOUNT',$2,'AWAITING_PRICING_AUTHORITY_AND_DRIVER_ACKNOWLEDGEMENT')`,
      [routeChange.rows[0]!.id, actor.accountId]
    );
    const nextVersion = journey.journeyVersion + 1;
    await client.query('UPDATE journey.journey SET aggregate_version = $2, updated_at = now() WHERE id = $1', [journeyId, nextVersion]);
    await appendJourneyEvent(client, {
      journeyId,
      eventType: request.requestType === 'ADD_STOP' ? 'journey.stop-requested' : 'journey.destination-change-requested',
      actorType: 'ACCOUNT', actorId: actor.accountId, commandId, correlationId,
      payload: { routeChangeRequestId: routeChange.rows[0]!.id, requestType: request.requestType, routeChanged: false, pricingStatus: 'NOT_EVALUATED' }
    });
    await client.query(
      `INSERT INTO journey.outbox_message
         (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
       VALUES ('Journey',$1,$2,'journey.route-change-requested',$3,$4,$5::jsonb)`,
      [journeyId, nextVersion, correlationId, commandId,
        JSON.stringify({ journeyId, routeChangeRequestId: routeChange.rows[0]!.id, requestType: request.requestType, pricingAndCommunicationRequired: true })]
    );
    const response: RouteChangeResult = {
      routeChangeRequestId: routeChange.rows[0]!.id,
      journeyId,
      requestType: request.requestType,
      status: 'PENDING_POLICY_REVIEW',
      pricingStatus: 'NOT_EVALUATED',
      routeChanged: false,
      message: 'Request recorded. The route is unchanged until pricing, authority, communication and Driver acknowledgement rules succeed.'
    };
    await writeJourneyCommand(client, { commandType: 'RequestRouteChange', actorId: actor.accountId, subjectId: journeyId, key: idempotencyKey, requestFingerprint, response });
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deriveCompletionRequirements(client: Pick<PoolClient, 'query'>, bookingId: string): Promise<CompletionRequirements> {
  const result = await client.query<{ id: string; requirement_type: string }>(
    `SELECT id, requirement_type FROM booking.booking_requirement WHERE booking_id = $1 ORDER BY created_at ASC`,
    [bookingId]
  );
  const types = result.rows.map((row) => row.requirement_type.toUpperCase());
  let serviceContext: CompletionRequirements['serviceContext'] = 'STANDARD';
  if (types.some((type) => type.includes('SCHOOL'))) serviceContext = 'SCHOOL';
  else if (types.some((type) => type.includes('HOSPITAL'))) serviceContext = 'HOSPITAL';
  else if (types.some((type) => type.includes('SPECIALIST') || type.includes('HANDOVER'))) serviceContext = 'SPECIALIST';
  const handoverRequired = serviceContext !== 'STANDARD' || types.some((type) => type === 'HANDOVER_REQUIRED');
  return { serviceContext, handoverRequired, sourceRequirementIds: result.rows.map((row) => row.id) };
}

function destinationDecision(location: LocationRow, journey: LockedJourney, now: Date, config: ApiConfig, radius: number) {
  return evaluateDestinationEvidence({
    latitude: Number(location.latitude), longitude: Number(location.longitude),
    observedAt: location.observed_at, receivedAt: now,
    accuracyMetres: Number(location.accuracy_metres), confidence: Number(location.confidence)
  }, {
    latitude: journey.dropoffLatitude, longitude: journey.dropoffLongitude
  }, {
    ...journeyLocationPolicy(config), destinationRadiusMetres: radius
  });
}

export async function markJourneyArriving(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<MarkArrivingResult> {
  const client = await pool.connect();
  const requestFingerprint = fingerprint({ journeyId, command: 'ARRIVING' });
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const journey = await readLockedJourney(client, journeyId);
    const duplicate = await readJourneyCommand<MarkArrivingResult>(client, 'MarkJourneyArriving', actor.accountId, journeyId, idempotencyKey, requestFingerprint);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    assertAssignedDriver(journey, actor);
    if (journey.journeyStatus !== 'IN_PROGRESS' || journey.bookingStatus !== 'IN_PROGRESS') {
      throw new JourneyConflictError(`Arriving requires IN_PROGRESS; found ${journey.journeyStatus}/${journey.bookingStatus}`);
    }
    const location = await latestActiveLocation(client, journeyId);
    if (!location) throw new JourneyEvidenceError(['ACTIVE_JOURNEY_LOCATION_MISSING']);
    const decision = destinationDecision(location, journey, new Date(), config, config.journeyArrivingRadiusMetres);
    if (!decision.accepted || !location.movement_plausible) {
      throw new JourneyEvidenceError([...decision.blockers, ...(!location.movement_plausible ? ['MOVEMENT_IMPLAUSIBLE'] : [])]);
    }
    const evidence = await client.query<{ id: string }>(
      `INSERT INTO journey.destination_approach_evidence
         (journey_id, journey_leg_id, location_observation_id, destination_snapshot_id,
          distance_metres, permitted_radius_metres, accepted, policy_version)
       VALUES ($1,$2,$3,$4,$5,$6,true,'destination-approach-v0.6') RETURNING id`,
      [journeyId, journey.journeyLegId, location.id, journey.dropoffSnapshotId, decision.distanceMetres, config.journeyArrivingRadiusMetres]
    );
    const requirements = await deriveCompletionRequirements(client, journey.bookingId);
    await client.query(
      `INSERT INTO journey.completion_requirement_snapshot
         (journey_id, journey_leg_id, service_context, handover_required, source_booking_requirement_ids, policy_version)
       VALUES ($1,$2,$3,$4,$5::uuid[],'completion-requirements-v0.6')`,
      [journeyId, journey.journeyLegId, requirements.serviceContext, requirements.handoverRequired, requirements.sourceRequirementIds]
    );
    const version = await appendJourneyTransition(client, journey, 'ARRIVING', actor, 'DESTINATION_APPROACH_EVIDENCE_ACCEPTED', {
      destinationApproachEvidenceId: evidence.rows[0]!.id,
      locationObservationId: location.id,
      distanceMetres: decision.distanceMetres,
      completionServiceContext: requirements.serviceContext,
      handoverRequired: requirements.handoverRequired
    }, correlationId, commandId);
    await appendBookingTransition(client, journey, 'ARRIVING', actor, 'DESTINATION_APPROACH_EVIDENCE_ACCEPTED', correlationId, randomUUID());
    await appendJourneyEvent(client, {
      journeyId, eventType: 'journey.arriving', actorType: 'ACCOUNT', actorId: actor.accountId,
      correlationId, payload: { destinationApproachEvidenceId: evidence.rows[0]!.id, completionServiceContext: requirements.serviceContext }
    });
    const response: MarkArrivingResult = {
      journeyId, bookingId: journey.bookingId, journeyStatus: 'ARRIVING', bookingStatus: 'ARRIVING',
      aggregateVersion: version, destinationApproachEvidenceId: evidence.rows[0]!.id, distanceMetres: decision.distanceMetres
    };
    await writeJourneyCommand(client, { commandType: 'MarkJourneyArriving', actorId: actor.accountId, subjectId: journeyId, key: idempotencyKey, requestFingerprint, response });
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeJourney(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string,
  config: ApiConfig
): Promise<CompleteJourneyResult> {
  const client = await pool.connect();
  const requestFingerprint = fingerprint({ journeyId, command: 'COMPLETE' });
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const journey = await readLockedJourney(client, journeyId);
    const duplicate = await readJourneyCommand<CompleteJourneyResult>(client, 'CompleteJourney', actor.accountId, journeyId, idempotencyKey, requestFingerprint);
    if (duplicate) {
      await client.query('COMMIT');
      return duplicate;
    }
    assertAssignedDriver(journey, actor);
    const location = await latestActiveLocation(client, journeyId);
    const finalDestination = location ? destinationDecision(location, journey, new Date(), config, config.journeyCompletionRadiusMetres) : null;
    const approach = await client.query<{ id: string }>(
      `SELECT id FROM journey.destination_approach_evidence
        WHERE journey_id = $1 AND journey_leg_id = $2 AND accepted = true LIMIT 1`,
      [journeyId, journey.journeyLegId]
    );
    const requirementSnapshot = await client.query<{
      id: string; service_context: CompletionRequirements['serviceContext']; handover_required: boolean;
    }>(
      `SELECT id, service_context, handover_required FROM journey.completion_requirement_snapshot
        WHERE journey_id = $1 AND journey_leg_id = $2 LIMIT 1`,
      [journeyId, journey.journeyLegId]
    );
    const latestHandover = await client.query<{ id: string; outcome: 'AUTHORISED_HANDOVER' | 'HANDOVER_FAILED' }>(
      `SELECT id, outcome FROM journey.handover_record
        WHERE journey_id = $1 AND journey_leg_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [journeyId, journey.journeyLegId]
    );
    const activeHold = await client.query(
      `SELECT 1 FROM journey.operational_hold WHERE journey_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [journeyId]
    );
    const continuityCase = await client.query(
      `SELECT 1 FROM journey.continuity_case WHERE journey_id = $1 AND status = 'OPEN' LIMIT 1`,
      [journeyId]
    );
    const latestHandoverRow = latestHandover.rows[0];
    const decision = evaluateJourneyCompletion({
      journeyStatus: journey.journeyStatus,
      bookingStatus: journey.bookingStatus,
      assignmentActive: journey.assignmentStatus === 'ACTIVE',
      destinationEvidenceAccepted: Boolean(approach.rowCount) && finalDestination?.accepted === true && location?.movement_plausible === true,
      activeCompletionHold: Boolean(activeHold.rowCount),
      continuityCaseOpen: Boolean(continuityCase.rowCount),
      handoverRequired: requirementSnapshot.rows[0]?.handover_required ?? true,
      authorisedHandoverRecorded: latestHandoverRow?.outcome === 'AUTHORISED_HANDOVER',
      handoverFailureOpen: latestHandoverRow?.outcome === 'HANDOVER_FAILED'
    });
    if (!decision.allowed || !location || !finalDestination || !requirementSnapshot.rowCount || !approach.rowCount) {
      const blockers: string[] = [...decision.blockers];
      if (!location) blockers.push('ACTIVE_JOURNEY_LOCATION_MISSING');
      if (!approach.rowCount) blockers.push('DESTINATION_APPROACH_EVIDENCE_MISSING');
      if (!requirementSnapshot.rowCount) blockers.push('COMPLETION_REQUIREMENTS_MISSING');
      if (location && !location.movement_plausible) blockers.push('MOVEMENT_IMPLAUSIBLE');
      throw new JourneyEvidenceError(blockers);
    }
    const completion = await client.query<{ id: string }>(
      `INSERT INTO journey.completion_evidence
         (journey_id, journey_leg_id, destination_approach_evidence_id, final_location_observation_id,
          final_distance_metres, completion_requirement_snapshot_id, handover_record_id, assignment_id,
          active_hold_checked, continuity_checked, accepted, policy_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,true,true,'journey-completion-v0.6') RETURNING id`,
      [journeyId, journey.journeyLegId, approach.rows[0]!.id, location.id, finalDestination.distanceMetres,
        requirementSnapshot.rows[0]!.id,
        latestHandoverRow?.outcome === 'AUTHORISED_HANDOVER' ? latestHandoverRow.id : null,
        journey.assignmentId]
    );
    const version = await appendJourneyTransition(client, journey, 'COMPLETED', actor, 'GOVERNED_COMPLETION_VALIDATED', {
      completionEvidenceId: completion.rows[0]!.id,
      finalLocationObservationId: location.id,
      finalDistanceMetres: finalDestination.distanceMetres,
      handoverRequired: requirementSnapshot.rows[0]!.handover_required,
      handoverRecordId: latestHandoverRow?.outcome === 'AUTHORISED_HANDOVER' ? latestHandoverRow.id : null,
      continuityOpen: Boolean(continuityCase.rowCount),
      activeHold: false
    }, correlationId, commandId);
    await appendBookingTransition(client, journey, 'COMPLETED', actor, 'GOVERNED_COMPLETION_VALIDATED', correlationId, randomUUID());
    const completedAssignment = await client.query(
      `UPDATE dispatch.driver_assignment SET status = 'COMPLETED', ended_at = now(), end_reason = 'JOURNEY_COMPLETED'
        WHERE id = $1 AND status = 'ACTIVE'`,
      [journey.assignmentId]
    );
    if (completedAssignment.rowCount !== 1) throw new JourneyConflictError('Active Driver assignment was not completed');
    const availability = await client.query<{ status: string; version: string | number }>(
      `SELECT status, version FROM driver.availability_state WHERE driver_profile_id = $1 FOR UPDATE`,
      [journey.driverProfileId]
    );
    if (!availability.rowCount) throw new JourneyConflictError('Driver availability state is missing at completion');
    if (availability.rows[0]!.status !== 'ASSIGNED') {
      throw new JourneyConflictError(`Driver availability must be ASSIGNED at completion; found ${availability.rows[0]!.status}`);
    }
    if (!canReleaseDriverAfterJourneyCompletion({
      from: 'ASSIGNED',
      to: 'AVAILABLE',
      journeyCompleted: true,
      assignmentCompleted: completedAssignment.rowCount === 1
    })) throw new JourneyConflictError('Driver availability release did not satisfy governed completion');
    const nextAvailabilityVersion = Number(availability.rows[0]!.version) + 1;
    await client.query(
      `UPDATE driver.availability_state SET status = 'AVAILABLE', version = $2, updated_at = now()
        WHERE driver_profile_id = $1`,
      [journey.driverProfileId, nextAvailabilityVersion]
    );
    await client.query(
      `INSERT INTO driver.availability_transition
         (driver_profile_id, from_status, to_status, version, command_id, reason_code)
       VALUES ($1,'ASSIGNED','AVAILABLE',$2,$3,'JOURNEY_COMPLETED')`,
      [journey.driverProfileId, nextAvailabilityVersion, randomUUID()]
    );
    await client.query(
      `INSERT INTO dispatch.outbox_message
         (aggregate_type, aggregate_id, event_type, correlation_id, causation_id, payload)
       VALUES ('DriverAssignment',$1,'dispatch.assignment.completed',$2,$3,$4::jsonb)`,
      [journey.assignmentId, correlationId, commandId,
        JSON.stringify({ assignmentId: journey.assignmentId, journeyId, bookingId: journey.bookingId, driverProfileId: journey.driverProfileId })]
    );
    await appendJourneyEvent(client, {
      journeyId, eventType: 'journey.completed', actorType: 'ACCOUNT', actorId: actor.accountId,
      correlationId, payload: { completionEvidenceId: completion.rows[0]!.id, paymentInitiated: false }
    });
    const response: CompleteJourneyResult = {
      journeyId, bookingId: journey.bookingId, journeyStatus: 'COMPLETED', bookingStatus: 'COMPLETED',
      aggregateVersion: version, completionEvidenceId: completion.rows[0]!.id,
      assignmentStatus: 'COMPLETED', driverAvailability: 'AVAILABLE', paymentInitiated: false
    };
    await writeJourneyCommand(client, { commandType: 'CompleteJourney', actorId: actor.accountId, subjectId: journeyId, key: idempotencyKey, requestFingerprint, response });
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getActiveJourneyProjection(
  pool: DatabasePool,
  journeyId: string,
  actor: AuthenticatedPrincipal,
  config: ApiConfig
): Promise<ActiveJourneyProjection> {
  const base = await getJourneyLiveProjection(pool, journeyId, actor, config);
  const result = await pool.query<{
    journey_health: ActiveJourneyProjection['journeyHealth'];
    latest_sequence: string | number;
    pending_route_changes: string | number;
    continuity_case_open: boolean;
    service_context: CompletionRequirements['serviceContext'] | null;
    handover_required: boolean | null;
    authorised_handover_recorded: boolean;
    handover_failure_open: boolean;
  }>(
    `SELECT
       CASE
         WHEN EXISTS (SELECT 1 FROM safety.safety_event se WHERE se.journey_id = j.id AND se.status <> 'RESOLVED' AND se.severity = 'CRITICAL') THEN 'INCIDENT'
         WHEN EXISTS (SELECT 1 FROM safety.safety_event se WHERE se.journey_id = j.id AND se.status <> 'RESOLVED' AND se.severity = 'AT_RISK') THEN 'AT_RISK'
         WHEN EXISTS (SELECT 1 FROM safety.safety_event se WHERE se.journey_id = j.id AND se.status <> 'RESOLVED') THEN 'ATTENTION'
         ELSE 'NORMAL'
       END AS journey_health,
       COALESCE((SELECT MAX(e.sequence_number) FROM journey.journey_event e WHERE e.journey_id = j.id), 0) AS latest_sequence,
       (SELECT COUNT(*) FROM journey.route_change_request change WHERE change.journey_id = j.id AND change.status = 'PENDING_POLICY_REVIEW') AS pending_route_changes,
       EXISTS (SELECT 1 FROM journey.continuity_case c WHERE c.journey_id = j.id AND c.status = 'OPEN') AS continuity_case_open,
       requirements.service_context,
       requirements.handover_required,
       EXISTS (SELECT 1 FROM journey.handover_record hr WHERE hr.journey_id = j.id AND hr.outcome = 'AUTHORISED_HANDOVER') AS authorised_handover_recorded,
       COALESCE((SELECT hr.outcome = 'HANDOVER_FAILED' FROM journey.handover_record hr WHERE hr.journey_id = j.id ORDER BY hr.created_at DESC LIMIT 1), false) AS handover_failure_open
      FROM journey.journey j
      LEFT JOIN journey.completion_requirement_snapshot requirements ON requirements.journey_id = j.id
     WHERE j.id = $1`,
    [journeyId]
  );
  const row = result.rows[0]!;
  const derived = row.service_context ? null : await deriveCompletionRequirements(pool, base.bookingId);
  return {
    ...base,
    journeyHealth: row.journey_health,
    latestJourneyEventSequence: Number(row.latest_sequence),
    pendingRouteChangeCount: Number(row.pending_route_changes),
    continuityCaseOpen: row.continuity_case_open,
    completionRequirements: {
      serviceContext: row.service_context ?? derived!.serviceContext,
      handoverRequired: row.handover_required ?? derived!.handoverRequired,
      authorisedHandoverRecorded: row.authorised_handover_recorded,
      handoverFailureOpen: row.handover_failure_open
    },
    reconnectInstruction: 'AUTHORITATIVE_SNAPSHOT'
  };
}
