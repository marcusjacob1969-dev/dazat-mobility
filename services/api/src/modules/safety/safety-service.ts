import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  healthForSafetySignal,
  routeConcernSeverity,
  silentAssistancePolicy,
  type JourneyHealthState,
  type RouteDeviationSeverity
} from '@dazat/domain';
import type { SafetySignalRequest, SafetySignalResult } from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import {
  assertJourneyParty,
  JourneyConflictError,
  readLockedJourney,
  type LockedJourney
} from '../journey/journey-service.js';

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

async function assertSafetyActor(
  client: Pick<PoolClient, 'query'>,
  journey: LockedJourney,
  actor: AuthenticatedPrincipal
): Promise<'DRIVER' | 'RIDER'> {
  if (actor.driverProfileId && actor.driverProfileId === journey.driverProfileId) return 'DRIVER';
  await assertJourneyParty(client, journey.bookingId, actor);
  return 'RIDER';
}

function routeConcernHealth(severity: RouteDeviationSeverity): JourneyHealthState {
  if (severity === 'CRITICAL') return 'INCIDENT';
  if (severity === 'SIGNIFICANT') return 'AT_RISK';
  return 'ATTENTION';
}

function safetySeverity(health: JourneyHealthState): 'ATTENTION' | 'AT_RISK' | 'CRITICAL' {
  if (health === 'INCIDENT') return 'CRITICAL';
  if (health === 'AT_RISK') return 'AT_RISK';
  return 'ATTENTION';
}

export async function createSafetySignal(
  pool: DatabasePool,
  request: SafetySignalRequest,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<SafetySignalResult> {
  const client = await pool.connect();
  const requestFingerprint = fingerprint(request);
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const journey = await readLockedJourney(client, request.journeyId);
    const actorRole = await assertSafetyActor(client, journey, actor);
    const duplicate = await client.query<{ response_body: SafetySignalResult; request_fingerprint: string }>(
      `SELECT response_body, request_fingerprint
         FROM safety.command_deduplication
        WHERE command_type = 'CreateSafetySignal' AND actor_id = $1 AND journey_id = $2 AND idempotency_key = $3`,
      [actor.accountId, request.journeyId, idempotencyKey]
    );
    if (duplicate.rowCount) {
      if (duplicate.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new JourneyConflictError('Idempotency key was reused with a materially different Safety request');
      }
      await client.query('COMMIT');
      return duplicate.rows[0]!.response_body;
    }
    if (!['IN_PROGRESS', 'ARRIVING'].includes(journey.journeyStatus)) {
      throw new JourneyConflictError(`Active Journey Safety signal is not accepted from ${journey.journeyStatus}`);
    }

    if (request.signalType === 'ROUTE_CONCERN' && !request.routeConcernCategory) {
      throw new JourneyConflictError('Route concern category is required');
    }
    const routeSeverity = request.signalType === 'ROUTE_CONCERN'
      ? routeConcernSeverity(request.routeConcernCategory!)
      : null;
    const journeyHealth = routeSeverity
      ? routeConcernHealth(routeSeverity)
      : healthForSafetySignal(request.signalType);
    const silence = request.signalType === 'SILENT_ASSISTANCE' ? silentAssistancePolicy() : null;
    const location = await client.query<{ id: string; telemetry_state: string }>(
      `SELECT id, telemetry_state
         FROM journey.driver_location_observation
        WHERE journey_id = $1 AND purpose = 'ACTIVE_JOURNEY'
        ORDER BY observed_at DESC, received_at DESC LIMIT 1`,
      [request.journeyId]
    );
    const locationRow = location.rows[0];

    let routeDeviationSignalId: string | null = null;
    if (routeSeverity) {
      const routeSignal = await client.query<{ id: string }>(
        `INSERT INTO journey.route_deviation_signal
           (journey_id, source, category, severity, confidence, location_observation_id,
            misconduct_finding, policy_version)
         VALUES ($1,$2,$3,$4::journey.route_deviation_severity,0.500,$5,false,'route-concern-v0.6')
         RETURNING id`,
        [request.journeyId, actorRole === 'DRIVER' ? 'DRIVER_REPORT' : 'RIDER_REPORT',
          request.routeConcernCategory, routeSeverity, locationRow?.id ?? null]
      );
      routeDeviationSignalId = routeSignal.rows[0]!.id;
    }

    const safetyEvent = await client.query<{ id: string }>(
      `INSERT INTO safety.safety_event
         (journey_id, trigger_type, severity, status, finding_status, source_reference,
          actor_person_id, signal_source, do_not_auto_call_reporter, location_confidence,
          facts, security_classification, correlation_id)
       VALUES ($1,$2,$3,'OPEN','NOT_ASSESSED',$4,$5,$6,$7,$8::journey.telemetry_confidence_state,
               $9::jsonb,'HIGHLY_RESTRICTED',$10)
       RETURNING id`,
      [request.journeyId, request.signalType, safetySeverity(journeyHealth), routeDeviationSignalId,
        actor.personId, actorRole, silence?.doNotAutoCallReporter ?? false,
        locationRow?.telemetry_state ?? 'UNKNOWN', JSON.stringify({
          routeConcernCategory: request.routeConcernCategory ?? null,
          routeDeviationSeverity: routeSeverity,
          routeDeviationSignalId,
          externalDeliveryRequiredForPersistence: false,
          misconductFindingCreated: false
        }), correlationId]
    );
    const safetyEventId = safetyEvent.rows[0]!.id;
    await client.query(
      `INSERT INTO safety.safety_event_transition
         (safety_event_id, from_status, to_status, actor_type, actor_id, reason_code)
       VALUES ($1,NULL,'OPEN',$2,$3,'SIGNAL_PERSISTED')`,
      [safetyEventId, actorRole, actor.accountId]
    );
    await client.query(
      `INSERT INTO safety.outbox_message
         (safety_event_id, event_type, event_version, security_classification,
          correlation_id, causation_id, payload)
       VALUES ($1,'safety.signal-created',1,'HIGHLY_RESTRICTED',$2,$3,$4::jsonb)`,
      [safetyEventId, correlationId, commandId, JSON.stringify({
        safetyEventId,
        journeyId: request.journeyId,
        signalType: request.signalType,
        journeyHealth,
        doNotAutoCallReporter: silence?.doNotAutoCallReporter ?? false,
        locationConfidence: locationRow?.telemetry_state ?? 'UNKNOWN'
      })]
    );

    const response: SafetySignalResult = {
      safetyEventId,
      journeyId: request.journeyId,
      signalType: request.signalType,
      status: 'OPEN',
      journeyHealth: journeyHealth as SafetySignalResult['journeyHealth'],
      doNotAutoCallReporter: silence?.doNotAutoCallReporter ?? false,
      persistedBeforeExternalDelivery: true,
      misconductFindingCreated: false
    };
    await client.query(
      `INSERT INTO safety.command_deduplication
         (command_id, idempotency_key, command_type, actor_id, journey_id,
          response_status, response_body, request_fingerprint)
       VALUES ($1,$2,'CreateSafetySignal',$3,$4,201,$5::jsonb,$6)`,
      [commandId, idempotencyKey, actor.accountId, request.journeyId, JSON.stringify(response), requestFingerprint]
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
