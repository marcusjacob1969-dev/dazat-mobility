import { createHash, randomUUID } from 'node:crypto';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import {
  COMMUNICATION_CHANNELS,
  acknowledgementAction,
  assessCommunicationCurrency,
  planCommunicationRoute,
  type ChannelHealthState,
  type CommunicationChannel,
  type CommunicationChannelCandidate,
  type MessageDeliveryState
} from '@dazat/domain';
import type {
  AcknowledgeCommunicationRequest,
  CommunicationAcknowledgementProjection,
  CommunicationInboxProjection,
  CommunicationProjection,
  CommunicationSummaryProjection,
  InternalCommunicationRequest,
  MessageDeliveryProjection
} from '@dazat/contracts';

export class CommunicationNotFoundError extends Error {}
export class CommunicationForbiddenError extends Error {}
export class CommunicationConflictError extends Error {}
export class CommunicationIdempotencyConflictError extends Error {}

interface CommunicationRow {
  id: string;
  purpose: CommunicationSummaryProjection['purpose'];
  priority: CommunicationSummaryProjection['priority'];
  recipient_person_id: string;
  recipient_role: string;
  status: CommunicationSummaryProjection['status'];
  template_key: string;
  template_version: string | number;
  source_aggregate_type: string;
  source_aggregate_id: string;
  source_aggregate_version: string | number;
  acknowledgement_required: boolean;
  acknowledgement_deadline: Date | null;
  expires_at: Date | null;
  created_at: Date;
  acknowledged_at?: Date | null;
}

interface DeliveryRow {
  id: string;
  channel: CommunicationChannel;
  attempt_number: string | number;
  state: MessageDeliveryState;
  contact_hint: string | null;
  provider_reference: string | null;
  failure_code: string | null;
  occurred_at: Date;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function summary(row: CommunicationRow): CommunicationSummaryProjection {
  return {
    communicationId: row.id,
    purpose: row.purpose,
    priority: row.priority,
    recipientRole: row.recipient_role,
    status: row.status,
    templateKey: row.template_key,
    templateVersion: Number(row.template_version),
    sourceAggregateType: row.source_aggregate_type,
    sourceAggregateId: row.source_aggregate_id,
    sourceAggregateVersion: Number(row.source_aggregate_version),
    acknowledgementRequired: row.acknowledgement_required,
    ...(row.acknowledgement_deadline ? { acknowledgementDeadline: row.acknowledgement_deadline.toISOString() } : {}),
    createdAt: row.created_at.toISOString(),
    ...(row.expires_at ? { expiresAt: row.expires_at.toISOString() } : {})
  };
}

function delivery(row: DeliveryRow): MessageDeliveryProjection {
  return {
    deliveryId: row.id,
    channel: row.channel,
    attemptNumber: Number(row.attempt_number),
    state: row.state,
    ...(row.contact_hint ? { contactHint: row.contact_hint } : {}),
    providerReferenceStored: row.provider_reference !== null,
    ...(row.failure_code ? { failureCode: row.failure_code } : {}),
    occurredAt: row.occurred_at.toISOString(),
    externalProviderExecutionEnabled: false
  };
}

export async function listCommunications(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<CommunicationInboxProjection> {
  const records = await pool.query<CommunicationRow>(
    `SELECT communication.*, acknowledgement.acknowledged_at
       FROM communications.communication communication
       LEFT JOIN communications.communication_acknowledgement acknowledgement
         ON acknowledgement.communication_id = communication.id
      WHERE communication.recipient_person_id = $1
      ORDER BY communication.created_at DESC, communication.id DESC
      LIMIT 100`,
    [actor.personId]
  );
  const health = await pool.query<{ channel: CommunicationChannel; state: ChannelHealthState; observed_at: Date }>(
    'SELECT channel, state, observed_at FROM communications.current_channel_health'
  );
  const observed = new Map(health.rows.map((row) => [row.channel, row]));
  return {
    communications: records.rows.map(summary),
    channelHealth: COMMUNICATION_CHANNELS.map((channel) => {
      const row = observed.get(channel);
      return row
        ? { channel, state: row.state, observedAt: row.observed_at.toISOString() }
        : { channel, state: 'UNKNOWN' as const };
    }),
    degradedModeExplicit: true,
    providerExecutionEnabled: false
  };
}

export async function getCommunication(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  communicationId: string
): Promise<CommunicationProjection> {
  const record = await pool.query<CommunicationRow>(
    `SELECT communication.*, acknowledgement.acknowledged_at
       FROM communications.communication communication
       LEFT JOIN communications.communication_acknowledgement acknowledgement
         ON acknowledgement.communication_id = communication.id
      WHERE communication.id = $1`,
    [communicationId]
  );
  if (!record.rowCount) throw new CommunicationNotFoundError('Communication not found');
  const row = record.rows[0]!;
  if (row.recipient_person_id !== actor.personId) throw new CommunicationForbiddenError('Communication belongs to another recipient');
  const deliveries = await pool.query<DeliveryRow>(
    `SELECT id, channel, attempt_number, state, contact_hint, provider_reference, failure_code, occurred_at
       FROM communications.message_delivery
      WHERE communication_id = $1 ORDER BY occurred_at, attempt_number, id`,
    [communicationId]
  );
  const latest = deliveries.rows.at(-1)?.state ?? 'QUEUED';
  return {
    ...summary(row),
    deliveries: deliveries.rows.map(delivery),
    ...(row.acknowledged_at ? { acknowledgedAt: row.acknowledged_at.toISOString() } : {}),
    acknowledgementEscalation: acknowledgementAction({
      acknowledgementRequired: row.acknowledgement_required,
      deliveryState: latest,
      acknowledgementDeadline: row.acknowledgement_deadline,
      acknowledgedAt: row.acknowledged_at ?? null,
      now: new Date()
    }),
    personalContactDetailsExposed: false,
    marketingSeparatedFromOperational: true,
    staleDeliverySuppressionEnabled: true
  };
}

export async function acknowledgeCommunication(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  communicationId: string,
  request: AcknowledgeCommunicationRequest,
  idempotencyKey: string
): Promise<CommunicationAcknowledgementProjection> {
  const client = await pool.connect();
  const requestFingerprint = fingerprint({ communicationId, request });
  try {
    await client.query('BEGIN');
    const priorCommand = await client.query<{ request_fingerprint: string; response_body: CommunicationAcknowledgementProjection }>(
      `SELECT request_fingerprint, response_body
         FROM communications.communication_command_deduplication
        WHERE command_type = 'AcknowledgeCommunication' AND actor_person_id = $1 AND idempotency_key = $2`,
      [actor.personId, idempotencyKey]
    );
    if (priorCommand.rowCount) {
      if (priorCommand.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new CommunicationIdempotencyConflictError('Idempotency key was reused for another acknowledgement');
      }
      await client.query('COMMIT');
      return { ...priorCommand.rows[0]!.response_body, repeatedAcknowledgement: true };
    }

    const record = await client.query<CommunicationRow>(
      'SELECT * FROM communications.communication WHERE id = $1 FOR UPDATE',
      [communicationId]
    );
    if (!record.rowCount) throw new CommunicationNotFoundError('Communication not found');
    const row = record.rows[0]!;
    if (row.recipient_person_id !== actor.personId) throw new CommunicationForbiddenError('Communication belongs to another recipient');
    if (!row.acknowledgement_required) throw new CommunicationConflictError('Communication does not require acknowledgement');
    if (row.status !== 'ACK_REQUIRED') throw new CommunicationConflictError('Communication is not awaiting acknowledgement');
    const acknowledgedAt = new Date(request.acknowledgedAt);
    if (acknowledgedAt.getTime() > Date.now() + 30_000) throw new CommunicationConflictError('Acknowledgement cannot be in the future');
    if (acknowledgedAt.getTime() < row.created_at.getTime()) {
      throw new CommunicationConflictError('Acknowledgement cannot predate the communication');
    }

    const existing = await client.query<{ id: string; communication_id: string; acknowledged_at: Date }>(
      `SELECT id, communication_id, acknowledged_at
         FROM communications.communication_acknowledgement
        WHERE recipient_person_id = $1
          AND (client_acknowledgement_id = $2 OR communication_id = $3)
        ORDER BY communication_id = $3 DESC
        LIMIT 1`,
      [actor.personId, request.clientAcknowledgementId, communicationId]
    );
    if (existing.rowCount && existing.rows[0]!.communication_id !== communicationId) {
      throw new CommunicationIdempotencyConflictError('Client acknowledgement ID was reused');
    }
    const acknowledgementId = existing.rows[0]?.id ?? randomUUID();
    const recordedAt = existing.rows[0]?.acknowledged_at ?? acknowledgedAt;
    if (!existing.rowCount) {
      await client.query(
        `INSERT INTO communications.communication_acknowledgement
           (id, communication_id, recipient_person_id, client_acknowledgement_id, acknowledged_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [acknowledgementId, communicationId, actor.personId, request.clientAcknowledgementId, recordedAt]
      );
      await client.query(
        `UPDATE communications.communication SET status = 'ACKNOWLEDGED', updated_at = now() WHERE id = $1`,
        [communicationId]
      );
      await client.query(
        `INSERT INTO communications.communication_status_event
           (communication_id, from_status, to_status, reason_code, actor_type, actor_id)
         VALUES ($1,$2,'ACKNOWLEDGED','RECIPIENT_ACKNOWLEDGED','RECIPIENT',$3)`,
        [communicationId, row.status, actor.personId]
      );
      await client.query(
        `INSERT INTO communications.communication_outbox_message
           (event_type, aggregate_id, correlation_id, causation_id, payload)
         VALUES ('communications.acknowledgement-recorded',$1,$2,$3,$4::jsonb)`,
        [communicationId, randomUUID(), randomUUID(), JSON.stringify({ communicationId, acknowledgementId })]
      );
    }
    const response: CommunicationAcknowledgementProjection = {
      communicationId,
      acknowledgementId,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: recordedAt.toISOString(),
      repeatedAcknowledgement: (existing.rowCount ?? 0) > 0
    };
    await client.query(
      `INSERT INTO communications.communication_command_deduplication
         (command_id, command_type, actor_person_id, idempotency_key, request_fingerprint, response_status, response_body)
       VALUES ($1,'AcknowledgeCommunication',$2,$3,$4,200,$5::jsonb)`,
      [randomUUID(), actor.personId, idempotencyKey, requestFingerprint, JSON.stringify(response)]
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

function channelsForContactType(type: 'EMAIL' | 'MOBILE' | 'LANDLINE'): readonly CommunicationChannel[] {
  if (type === 'EMAIL') return ['EMAIL'];
  if (type === 'LANDLINE') return ['VOICE_CALL', 'MASKED_CALL'];
  return ['SMS', 'VOICE_CALL', 'MASKED_CALL'];
}

export async function requestInternalCommunication(
  pool: DatabasePool,
  request: InternalCommunicationRequest,
  createdByService: string
): Promise<{ communicationId: string; status: CommunicationSummaryProjection['status']; suppressionReason?: string }> {
  const now = new Date();
  const expiresAt = request.expiresAt ? new Date(request.expiresAt) : null;
  const currency = assessCommunicationCurrency({
    communicationStatus: 'QUEUED',
    sourceAggregateVersion: request.sourceAggregateVersion,
    currentAggregateVersion: request.currentAggregateVersion,
    expiresAt,
    now
  });
  const template = await pool.query<{ locale: string }>(
    `SELECT locale FROM communications.communication_template_version
      WHERE template_key = $1 AND version = $2 AND purpose = $3 AND status = 'APPROVED'
      ORDER BY locale = 'en-GB' DESC LIMIT 1`,
    [request.templateKey, request.templateVersion, request.purpose]
  );
  const contacts = await pool.query<{
    id: string; type: 'EMAIL' | 'MOBILE' | 'LANDLINE'; display_hint: string; verified: boolean; purpose_denied: boolean;
  }>(
    `SELECT contact.id, contact.type, contact.display_hint,
            EXISTS (
              SELECT 1 FROM identity.verification_record verification
               WHERE verification.contact_point_id = contact.id AND verification.status = 'VERIFIED'
                 AND (verification.expires_at IS NULL OR verification.expires_at > now())
            ) AS verified,
            EXISTS (
              SELECT 1 FROM identity.contact_permission permission
               WHERE permission.contact_point_id = contact.id AND permission.purpose = $2
                 AND permission.status IN ('DENIED','REVOKED')
                 AND permission.effective_from <= now()
                 AND (permission.effective_to IS NULL OR permission.effective_to > now())
            ) AS purpose_denied
       FROM identity.contact_point contact
      WHERE contact.person_id = $1 AND contact.status = 'ACTIVE'`,
    [request.recipientPersonId, request.purpose]
  );
  const preference = await pool.query<{ blocked_channels: CommunicationChannel[]; marketing_consent_granted: boolean }>(
    `SELECT blocked_channels, marketing_consent_granted
       FROM communications.communication_preference_version
      WHERE person_id = $1 AND purpose = $2 AND effective_to IS NULL
      LIMIT 1`,
    [request.recipientPersonId, request.purpose]
  );
  const health = await pool.query<{ channel: CommunicationChannel; state: ChannelHealthState }>(
    'SELECT channel, state FROM communications.current_channel_health'
  );
  const healthByChannel = new Map(health.rows.map((row) => [row.channel, row.state]));
  const contactByChannel = new Map<CommunicationChannel, { verified: boolean; denied: boolean }>();
  for (const contact of contacts.rows) {
    for (const channel of channelsForContactType(contact.type)) {
      const previous = contactByChannel.get(channel);
      contactByChannel.set(channel, {
        verified: contact.verified || previous?.verified === true,
        denied: contact.purpose_denied && previous?.denied !== false
      });
    }
  }
  const blocked = new Set(preference.rows[0]?.blocked_channels ?? []);
  const candidates: CommunicationChannelCandidate[] = request.requestedChannels.map((channel) => ({
    channel,
    contactPointVerified: ['IN_APP', 'PUSH', 'PROTECTED_CHAT', 'AUTHENTICATED_PORTAL'].includes(channel)
      || contactByChannel.get(channel)?.verified === true,
    permissionAllowed: !blocked.has(channel) && contactByChannel.get(channel)?.denied !== true,
    health: healthByChannel.get(channel) ?? 'UNKNOWN',
    compromised: false
  }));
  const route = planCommunicationRoute({
    purpose: request.purpose,
    priority: request.priority,
    candidates,
    marketingConsentGranted: preference.rows[0]?.marketing_consent_granted ?? false,
    quietHoursActive: request.quietHoursActive,
    silentAssistance: request.silentAssistance
  });

  let suppressionReason: string | undefined;
  if (!currency.current) suppressionReason = currency.suppressionReason;
  else if (!template.rowCount) suppressionReason = 'TEMPLATE_UNAVAILABLE';
  else if (route.state === 'SUPPRESSED_NO_CONSENT') suppressionReason = 'NO_MARKETING_CONSENT';
  else if (route.state === 'NO_SAFE_CHANNEL') suppressionReason = 'NO_SAFE_CHANNEL';
  const status: CommunicationSummaryProjection['status'] = suppressionReason ? 'SUPPRESSED' : 'QUEUED';
  const communicationId = randomUUID();
  const correlationId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO communications.communication
         (id, purpose, priority, recipient_person_id, recipient_role, template_key, template_version, locale,
          source_aggregate_type, source_aggregate_id, source_aggregate_version, status, suppression_reason,
          acknowledgement_required, acknowledgement_deadline, expires_at, created_by_service)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [communicationId, request.purpose, request.priority, request.recipientPersonId, request.recipientRole,
        request.templateKey, request.templateVersion, template.rows[0]?.locale ?? 'en-GB', request.sourceAggregateType,
        request.sourceAggregateId, request.sourceAggregateVersion, status, suppressionReason ?? null,
        request.acknowledgementRequired, request.acknowledgementDeadline ?? null, request.expiresAt ?? null, createdByService]
    );
    await client.query(
      `INSERT INTO communications.communication_delivery_plan
         (communication_id, route_state, planned_channels, fallback_required, fallback_policy_version,
          silent_assistance, voice_or_auto_call_allowed)
       VALUES ($1,$2,$3,$4,'phase-0.13-provider-disabled',$5,$6)`,
      [communicationId, route.state, route.channels, route.fallbackRequired, request.silentAssistance,
        !request.silentAssistance && route.channels.some((channel) => channel === 'VOICE_CALL' || channel === 'MASKED_CALL')]
    );
    await client.query(
      `INSERT INTO communications.communication_status_event
         (communication_id, from_status, to_status, reason_code, actor_type)
       VALUES ($1,NULL,$2,$3,'SERVICE')`,
      [communicationId, status, suppressionReason ?? 'COMMUNICATION_REQUESTED']
    );
    await client.query(
      `INSERT INTO communications.communication_outbox_message
         (event_type, aggregate_id, correlation_id, causation_id, payload)
       VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [suppressionReason ? 'communications.communication-suppressed' : 'communications.communication-requested',
        communicationId, correlationId, randomUUID(), JSON.stringify({ communicationId, status, suppressionReason: suppressionReason ?? null })]
    );
    await client.query('COMMIT');
    return { communicationId, status, ...(suppressionReason ? { suppressionReason } : {}) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
