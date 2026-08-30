import { CONTACT_CASE_QUEUES } from '@dazat/domain';
import type {
  ChannelProviderHealthProjection,
  CommunicationsOperationsCapabilitiesProjection,
  CommunicationsOperationsStatusProjection,
  ContactCaseListProjection,
  ContactCaseSummaryProjection
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export function getCommunicationsOperationsCapabilities(): CommunicationsOperationsCapabilitiesProjection {
  return {
    notificationPolicyCatalogueModelled: true,
    deliveryAssuranceModelled: true,
    contactCaseContinuityModelled: true,
    providerHealthModelled: true,
    serviceLevelObservationModelled: true,
    scenarioSimulationModelled: true,
    externalProviderExecutionEnabled: false,
    contactCentreStaffMutationEnabled: false,
    personalToolWorkaroundAllowed: false,
    sensitiveContentInAggregateMetrics: false,
    queues: CONTACT_CASE_QUEUES
  };
}

export async function listRecipientContactCases(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<ContactCaseListProjection> {
  const result = await pool.query<{
    id: string;
    status: ContactCaseSummaryProjection['status'];
    queue: ContactCaseSummaryProjection['queue'];
    priority: ContactCaseSummaryProjection['priority'];
    purpose: string;
    current_contact_status: ContactCaseSummaryProjection['currentContactStatus'];
    owner_person_id: string | null;
    next_action: string;
    attention_at: Date;
    linked_booking_id: string | null;
    linked_journey_id: string | null;
    linked_canonical_case_type: string | null;
    linked_canonical_case_id: string | null;
    updated_at: Date;
  }>(
    `SELECT id, status, queue, priority, purpose, current_contact_status, owner_person_id,
            next_action, attention_at, linked_booking_id, linked_journey_id,
            linked_canonical_case_type, linked_canonical_case_id, updated_at
       FROM communications.contact_case
      WHERE person_id = $1
      ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
               attention_at, updated_at DESC
      LIMIT 100`,
    [actor.personId]
  );
  return {
    cases: result.rows.map((row) => ({
      contactCaseId: row.id,
      status: row.status,
      queue: row.queue,
      priority: row.priority,
      purpose: row.purpose,
      currentContactStatus: row.current_contact_status,
      ownerAssigned: Boolean(row.owner_person_id),
      nextAction: row.next_action,
      attentionAt: row.attention_at.toISOString(),
      ...(row.linked_booking_id ? { linkedBookingId: row.linked_booking_id } : {}),
      ...(row.linked_journey_id ? { linkedJourneyId: row.linked_journey_id } : {}),
      ...(row.linked_canonical_case_type ? { linkedCanonicalCaseType: row.linked_canonical_case_type } : {}),
      ...(row.linked_canonical_case_id ? { linkedCanonicalCaseId: row.linked_canonical_case_id } : {}),
      channelHistoryPreserved: true,
      replacesCanonicalDomainCase: false,
      updatedAt: row.updated_at.toISOString()
    })),
    contactCentreStaffMutationEnabled: false,
    personalToolWorkaroundAllowed: false
  };
}

export async function getRecipientCommunicationsOperationsStatus(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<CommunicationsOperationsStatusProjection> {
  const [health, failureCount, acknowledgementCount] = await Promise.all([
    pool.query<{
      channel: ChannelProviderHealthProjection['channel'];
      region_code: string;
      state: ChannelProviderHealthProjection['state'];
      observed_at: Date;
    }>(
      `SELECT DISTINCT ON (channel, region_code) channel, region_code, state, observed_at
         FROM communications.channel_provider_health_observation
        ORDER BY channel, region_code, observed_at DESC, id DESC`
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM communications.communication_failure_case failure_case
         JOIN communications.communication communication
           ON communication.id = failure_case.communication_id
        WHERE communication.recipient_person_id = $1
          AND failure_case.priority IN ('P0','P1')
          AND failure_case.status <> 'RESOLVED'`,
      [actor.personId]
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM communications.critical_acknowledgement_requirement requirement
         JOIN communications.communication communication
           ON communication.id = requirement.communication_id
        WHERE communication.recipient_person_id = $1
          AND requirement.status IN ('WAITING','DEADLINE_MISSED','ESCALATED')`,
      [actor.personId]
    )
  ]);
  return {
    channelHealth: health.rows.map((row) => ({
      channel: row.channel,
      regionCode: row.region_code,
      state: row.state,
      observedAt: row.observed_at.toISOString(),
      providerConfigured: false,
      providerAcceptanceTreatedAsDelivery: false
    })),
    openCriticalFailureCaseCount: Number(failureCount.rows[0]?.count ?? 0),
    pendingCriticalAcknowledgementCount: Number(acknowledgementCount.rows[0]?.count ?? 0),
    aggregateMetricsExcludeSensitiveContent: true,
    recoveryRevalidatesCurrentState: true,
    externalProviderExecutionEnabled: false
  };
}
