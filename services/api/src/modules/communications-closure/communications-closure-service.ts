import {
  COMMUNICATION_ACCEPTANCE_SCENARIOS,
  COMMUNICATION_CONCEPTUAL_API_OPERATIONS,
  COMMUNICATION_LAUNCH_GATES,
  COMMUNICATION_P0_REQUIREMENTS,
  COMMUNICATION_RECIPIENT_ROLES,
  COMMUNICATION_SOURCE_DOMAINS,
  CRITICAL_COMMUNICATION_EVENT_TYPES
} from '@dazat/domain';
import type {
  CommunicationLaunchGateProjection,
  CommunicationsClosureCapabilitiesProjection,
  CommunicationsClosureStatusProjection,
  CommunicationsLaunchReadinessProjection
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export function getCommunicationsClosureCapabilities(): CommunicationsClosureCapabilitiesProjection {
  return {
    canonicalRequestContractModelled: true,
    versionedEventEnvelopeModelled: true,
    recipientPermissionMatrixModelled: true,
    orderedDeliveryDecisionModelled: true,
    degradedModeContractModelled: true,
    acceptanceCatalogueModelled: true,
    launchGateCatalogueModelled: true,
    criticalEventTypes: CRITICAL_COMMUNICATION_EVENT_TYPES,
    conceptualApiOperations: COMMUNICATION_CONCEPTUAL_API_OPERATIONS,
    p0Requirements: COMMUNICATION_P0_REQUIREMENTS,
    sourceDomains: COMMUNICATION_SOURCE_DOMAINS,
    recipientRoles: COMMUNICATION_RECIPIENT_ROLES,
    acceptanceScenarios: COMMUNICATION_ACCEPTANCE_SCENARIOS,
    launchGates: COMMUNICATION_LAUNCH_GATES,
    communicationsInventsBusinessState: false,
    endpointCallGrantsDomainAuthority: false,
    unmanagedProviderBypassAllowed: false,
    voiceAiHighRiskDecisionAllowed: false,
    externalProviderExecutionEnabled: false,
    communicationsClosureMutationsEnabled: false,
    conceptualCommandMutationsImplemented: false
  };
}

export async function getRecipientCommunicationsClosureStatus(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<CommunicationsClosureStatusProjection> {
  const result = await pool.query<{
    communication_request_count: string;
    canonical_contract_count: string;
    suppressed_stale_request_count: string;
    communication_created_count: string;
    pending_or_escalated_count: string;
  }>(
    `SELECT count(DISTINCT request.id)::text AS communication_request_count,
            count(DISTINCT contract.id)::text AS canonical_contract_count,
            count(DISTINCT request.id) FILTER (WHERE request.status = 'SUPPRESSED_STALE')::text AS suppressed_stale_request_count,
            count(DISTINCT request.id) FILTER (WHERE request.status = 'COMMUNICATION_CREATED')::text AS communication_created_count,
            count(DISTINCT request.id) FILTER (WHERE request.status IN ('REQUESTED','POLICY_RESOLVED','ESCALATED'))::text AS pending_or_escalated_count
       FROM communications.communication_request request
       LEFT JOIN communications.communication_request_contract contract
         ON contract.communication_request_id = request.id
      WHERE request.recipient_person_id = $1`,
    [actor.personId]
  );
  const row = result.rows[0];
  return {
    communicationRequestCount: Number(row?.communication_request_count ?? 0),
    canonicalContractCount: Number(row?.canonical_contract_count ?? 0),
    suppressedStaleRequestCount: Number(row?.suppressed_stale_request_count ?? 0),
    communicationCreatedCount: Number(row?.communication_created_count ?? 0),
    pendingOrEscalatedCount: Number(row?.pending_or_escalated_count ?? 0),
    recipientScoped: true,
    authoritativeEventRequired: true,
    rolePermissionRequired: true,
    priorityGrantsAdditionalDataAccess: false,
    providerAcceptanceTreatedAsDelivery: false,
    externalProviderExecutionEnabled: false
  };
}

export async function getCommunicationsLaunchReadiness(
  pool: DatabasePool
): Promise<CommunicationsLaunchReadinessProjection> {
  const result = await pool.query<{
    gate_key: CommunicationLaunchGateProjection['gate'];
    status: CommunicationLaunchGateProjection['status'] | null;
    evidence_reference: string | null;
  }>(
    `SELECT DISTINCT ON (gate.gate_key)
            gate.gate_key, evidence.status, evidence.evidence_reference
       FROM communications.communication_launch_gate_version gate
       LEFT JOIN communications.communication_launch_gate_evidence evidence
         ON evidence.launch_gate_version_id = gate.id
      WHERE gate.status = 'ACTIVE'
      ORDER BY gate.gate_key, evidence.evidence_sequence DESC NULLS LAST`
  );
  const stored = new Map(result.rows.map((row) => [row.gate_key, row] as const));
  const gates = COMMUNICATION_LAUNCH_GATES.map((gate): CommunicationLaunchGateProjection => {
    const row = stored.get(gate);
    return {
      gate,
      status: row?.status ?? 'NOT_TESTED',
      ...(row?.evidence_reference ? { evidenceReference: row.evidence_reference } : {})
    };
  });
  return {
    gates,
    evidenceComplete: gates.every((gate) => gate.status === 'PASS'),
    productionPoliciesApproved: false,
    providerSelectedAndContracted: false,
    operationsStaffingApproved: false,
    privacyRetentionApproved: false,
    pilotReady: false,
    providerExecutionMayBeEnabledAtThisCheckpoint: false
  };
}
