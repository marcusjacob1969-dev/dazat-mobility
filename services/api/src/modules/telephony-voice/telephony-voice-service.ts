import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import { CALL_QUEUES } from '@dazat/domain';
import type {
  CallSessionSummaryProjection,
  CallerIdentityAssessmentProjection,
  ContactPlanProjection,
  TelephonyInteractionListProjection,
  TelephonyServiceCapabilitiesProjection
} from '@dazat/contracts';

export class TelephonyVoiceNotFoundError extends Error {}

export function getTelephonyServiceCapabilities(): TelephonyServiceCapabilitiesProjection {
  return {
    telephoneUsesCanonicalEngines: true,
    telephoneProviderConfigured: false,
    voiceAssistantConfigured: false,
    operatorConsoleMutationConfigured: false,
    securePaymentHandoffConfigured: false,
    recordingConfigured: false,
    transcriptionConfigured: false,
    interpreterRoutingConfigured: false,
    voiceBiometricsConfigured: false,
    callerIdAuthenticates: false,
    generalVoiceCapturesFullCardDetails: false,
    statusUnknownBlindRetryAllowed: false,
    humanHandoffQueues: CALL_QUEUES
  };
}

export async function getContactPlan(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<ContactPlanProjection> {
  const result = await pool.query<{
    version: string | number;
    safe_channels: string[];
    arrival_method: string | null;
    permitted_intermediary_roles: string[];
    permitted_actions: ContactPlanProjection['permittedActions'];
    language: string | null;
    accessibility_communication_needs: string[];
  }>(
    `SELECT version, safe_channels, arrival_method, permitted_intermediary_roles,
            permitted_actions, language, accessibility_communication_needs
       FROM communications.contact_plan_version
      WHERE person_id = $1 AND status = 'ACTIVE'
      ORDER BY version DESC LIMIT 1`,
    [actor.personId]
  );
  if (!result.rowCount) {
    return {
      status: 'NOT_CONFIGURED',
      safeChannels: [],
      permittedIntermediaryRoles: [],
      permittedActions: [],
      accessibilityCommunicationNeeds: [],
      diagnosisStored: false,
      personalContactDetailsExposed: false
    };
  }
  const row = result.rows[0]!;
  return {
    status: 'CONFIGURED',
    version: Number(row.version),
    safeChannels: row.safe_channels,
    ...(row.arrival_method ? { arrivalMethod: row.arrival_method } : {}),
    permittedIntermediaryRoles: row.permitted_intermediary_roles,
    permittedActions: row.permitted_actions,
    ...(row.language ? { language: row.language } : {}),
    accessibilityCommunicationNeeds: row.accessibility_communication_needs,
    diagnosisStored: false,
    personalContactDetailsExposed: false
  };
}

export async function listTelephonyInteractions(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<TelephonyInteractionListProjection> {
  const calls = await pool.query<{
    id: string;
    direction: CallSessionSummaryProjection['direction'];
    status: CallSessionSummaryProjection['status'];
    purpose: string;
    queue: CallSessionSummaryProjection['queue'] | null;
    language: string | null;
    call_quality: CallSessionSummaryProjection['callQuality'];
    linked_booking_id: string | null;
    linked_case_id: string | null;
    started_at: Date;
    ended_at: Date | null;
    assessment_id: string | null;
    claimed_role: CallerIdentityAssessmentProjection['claimedRole'] | null;
    assessment_confidence: string | number | null;
    assessment_outcome: CallerIdentityAssessmentProjection['outcome'] | null;
    assessment_restrictions: string[] | null;
    assessed_at: Date | null;
    warm_handoff_context_present: boolean;
    pending_interaction_preserved: boolean;
  }>(
    `SELECT call.id, call.direction, call.status, call.purpose, call.queue, call.language,
            call.call_quality, call.linked_booking_id, call.linked_case_id, call.started_at, call.ended_at,
            assessment.id AS assessment_id, assessment.claimed_role,
            assessment.confidence AS assessment_confidence, assessment.outcome AS assessment_outcome,
            assessment.restrictions AS assessment_restrictions, assessment.assessed_at,
            EXISTS (
              SELECT 1 FROM communications.call_transfer transfer
               WHERE transfer.call_session_id = call.id AND transfer.warm_handoff
            ) AS warm_handoff_context_present,
            EXISTS (
              SELECT 1 FROM communications.pending_telephone_interaction pending
               WHERE pending.call_session_id = call.id
                 AND pending.status IN ('ACTIVE','CALL_DROPPED','RESUMED')
            ) AS pending_interaction_preserved
       FROM communications.call_session call
       LEFT JOIN LATERAL (
         SELECT identity_assessment.*
           FROM communications.caller_identity_assessment identity_assessment
          WHERE identity_assessment.call_session_id = call.id
          ORDER BY identity_assessment.assessed_at DESC, identity_assessment.id DESC
          LIMIT 1
       ) assessment ON true
      WHERE call.resolved_person_id = $1
      ORDER BY call.started_at DESC, call.id DESC
      LIMIT 100`,
    [actor.personId]
  );
  return {
    interactions: calls.rows.map((row) => ({
      callSessionId: row.id,
      direction: row.direction,
      status: row.status,
      purpose: row.purpose,
      ...(row.queue ? { queue: row.queue } : {}),
      ...(row.language ? { language: row.language } : {}),
      callQuality: row.call_quality,
      ...(row.linked_booking_id ? { linkedBookingId: row.linked_booking_id } : {}),
      ...(row.linked_case_id ? { linkedCaseId: row.linked_case_id } : {}),
      ...(row.assessment_id && row.claimed_role && row.assessment_outcome && row.assessed_at
        ? {
            latestCallerAssessment: {
              assessmentId: row.assessment_id,
              claimedRole: row.claimed_role,
              confidence: Number(row.assessment_confidence),
              outcome: row.assessment_outcome,
              restrictions: row.assessment_restrictions ?? [],
              callerIdTreatedAsIdentityProof: false,
              assessedAt: row.assessed_at.toISOString()
            }
          }
        : {}),
      warmHandoffContextPresent: row.warm_handoff_context_present,
      pendingInteractionPreserved: row.pending_interaction_preserved,
      personalNumberExposed: false,
      startedAt: row.started_at.toISOString(),
      ...(row.ended_at ? { endedAt: row.ended_at.toISOString() } : {})
    })),
    telephonyProviderConfigured: false,
    voiceAssistantConfigured: false,
    degradedModeExplicit: true
  };
}
