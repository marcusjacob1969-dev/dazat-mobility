import {
  INSTITUTIONAL_ATTENTION_PRIORITIES,
  INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS,
  INSTITUTIONAL_LIVE_API_PATHS,
  INSTITUTIONAL_LIVE_COMMANDS,
  INSTITUTIONAL_LIVE_EVENTS,
  INSTITUTIONAL_LIVE_OUTCOMES,
  INSTITUTIONAL_LIVE_P0_REQUIREMENTS,
  INSTITUTION_EXCEPTION_STATES,
  INSTITUTION_READINESS_OUTCOMES,
  INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES,
  PASSENGER_READY_STATES
} from '@dazat/domain';
import type {
  InstitutionalAttentionSummaryProjection,
  InstitutionalLiveOperationsCapabilitiesProjection,
  InstitutionalLiveOperationsContextProjection,
  InstitutionTransportExceptionSummaryProjection
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export function getInstitutionalLiveOperationsCapabilities(): InstitutionalLiveOperationsCapabilitiesProjection {
  return {
    attentionPriorities: INSTITUTIONAL_ATTENTION_PRIORITIES,
    exceptionCategories: INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES,
    exceptionStates: INSTITUTION_EXCEPTION_STATES,
    readinessOutcomes: INSTITUTION_READINESS_OUTCOMES,
    passengerReadyStates: PASSENGER_READY_STATES,
    outcomeClassifications: INSTITUTIONAL_LIVE_OUTCOMES,
    conceptualApiPaths: INSTITUTIONAL_LIVE_API_PATHS,
    conceptualCommands: INSTITUTIONAL_LIVE_COMMANDS,
    events: INSTITUTIONAL_LIVE_EVENTS,
    p0Requirements: INSTITUTIONAL_LIVE_P0_REQUIREMENTS,
    acceptanceScenarios: INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS,
    canonicalBookingDispatchJourneyTruthPreserved: true,
    specialistSafetyFinanceRescueCasesRemainAuthoritative: true,
    resolvedAndVerifiedRemainDistinct: true,
    manualDispatchBypassesEligibility: false,
    serviceHealthAutomaticallyCancelsBooking: false,
    signedContractAloneEnablesLaunch: false,
    exitMayAbandonActivePassenger: false,
    institutionalLiveMutationsEnabled: false
  };
}

type InstitutionalLiveContextRow = {
  organisation_id: string;
  open_p0_p1_attention_count: string;
  open_exception_count: string;
  at_risk_or_blocked_readiness_count: string;
  open_data_quality_issue_count: string;
  active_disruption_count: string;
  latest_service_health_status: InstitutionalLiveOperationsContextProjection['latestServiceHealthStatus'];
  launch_readiness_status: InstitutionalLiveOperationsContextProjection['launchReadinessStatus'];
  active_pilot_status: InstitutionalLiveOperationsContextProjection['activePilotStatus'];
  exit_plan_status: InstitutionalLiveOperationsContextProjection['exitPlanStatus'];
  attention_items: InstitutionalAttentionSummaryProjection[];
  transport_exceptions: InstitutionTransportExceptionSummaryProjection[];
};

export async function getActorInstitutionalLiveOperationsContext(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  organisationId: string
): Promise<InstitutionalLiveOperationsContextProjection | null> {
  const result = await pool.query<InstitutionalLiveContextRow>(
    `SELECT organisation.id AS organisation_id,
            (SELECT count(*)::text FROM organisation.institutional_attention_item attention
              WHERE attention.organisation_id = organisation.id
                AND attention.priority IN ('P0','P1')
                AND attention.status IN ('OPEN','OWNED','IN_PROGRESS','WAITING')) AS open_p0_p1_attention_count,
            (SELECT count(*)::text FROM organisation.institution_live_transport_exception exception
              WHERE exception.organisation_id = organisation.id
                AND exception.status NOT IN ('VERIFIED','CLOSED','MERGED','SUPERSEDED')) AS open_exception_count,
            (SELECT count(*)::text FROM (
                SELECT DISTINCT ON (readiness.booking_occurrence_id) readiness.outcome
                  FROM organisation.institution_readiness_assessment readiness
                 WHERE readiness.organisation_id = organisation.id
                 ORDER BY readiness.booking_occurrence_id, readiness.assessed_at DESC, readiness.id DESC
              ) latest_readiness WHERE latest_readiness.outcome IN ('AT_RISK','BLOCKED')) AS at_risk_or_blocked_readiness_count,
            (SELECT count(*)::text FROM organisation.institutional_data_quality_issue quality
              WHERE quality.organisation_id = organisation.id
                AND quality.status IN ('OPEN','IN_PROGRESS')) AS open_data_quality_issue_count,
            (SELECT count(*)::text FROM organisation.institution_disruption_event disruption
              WHERE disruption.organisation_id = organisation.id
                AND disruption.active_window @> now()) AS active_disruption_count,
            (SELECT health.status FROM organisation.organisation_service_health health
              WHERE health.organisation_id = organisation.id
              ORDER BY health.assessment_version DESC, health.assessed_at DESC LIMIT 1) AS latest_service_health_status,
            (SELECT readiness.status FROM organisation.institution_launch_readiness readiness
              WHERE readiness.organisation_id = organisation.id
              ORDER BY readiness.updated_at DESC, readiness.id DESC LIMIT 1) AS launch_readiness_status,
            (SELECT pilot.status FROM organisation.institution_pilot pilot
              WHERE pilot.organisation_id = organisation.id
                AND pilot.status IN ('PLANNED','ACTIVE','GATE_REVIEW','PAUSED')
              ORDER BY pilot.created_at DESC, pilot.id DESC LIMIT 1) AS active_pilot_status,
            (SELECT exit_plan.status FROM organisation.institution_exit_plan exit_plan
              WHERE exit_plan.organisation_id = organisation.id
              ORDER BY exit_plan.updated_at DESC, exit_plan.id DESC LIMIT 1) AS exit_plan_status,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'attentionId', scoped.id,
                'priority', scoped.priority,
                'status', scoped.status,
                'sourceType', scoped.source_type,
                'ownerAssigned', scoped.owner_person_id IS NOT NULL,
                'nextAction', scoped.next_action,
                'attentionDeadline', scoped.attention_deadline
              ) ORDER BY scoped.priority, scoped.attention_deadline NULLS LAST, scoped.id)
              FROM (SELECT * FROM organisation.institutional_attention_item attention
                     WHERE attention.organisation_id = organisation.id
                       AND attention.status IN ('OPEN','OWNED','IN_PROGRESS','WAITING')
                     ORDER BY attention.priority, attention.attention_deadline NULLS LAST, attention.id LIMIT 50) scoped), '[]'::jsonb) AS attention_items,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'exceptionId', scoped.id,
                'category', scoped.category,
                'severity', scoped.severity,
                'status', scoped.status,
                'ownerAssigned', scoped.owner_person_id IS NOT NULL,
                'attentionDeadline', scoped.attention_deadline,
                'resolutionVerified', scoped.status IN ('VERIFIED','CLOSED')
              ) ORDER BY scoped.severity, scoped.attention_deadline NULLS LAST, scoped.id)
              FROM (SELECT * FROM organisation.institution_live_transport_exception exception
                     WHERE exception.organisation_id = organisation.id
                       AND exception.status NOT IN ('CLOSED','MERGED','SUPERSEDED')
                     ORDER BY exception.severity, exception.attention_deadline NULLS LAST, exception.id LIMIT 50) scoped), '[]'::jsonb) AS transport_exceptions
       FROM organisation.organisation_user_membership membership
       JOIN organisation.organisation organisation ON organisation.id = membership.organisation_id
      WHERE membership.person_id = $1
        AND membership.organisation_id = $2
        AND membership.status = 'ACTIVE'
        AND membership.valid_from <= now()
        AND (membership.valid_until IS NULL OR membership.valid_until > now())
        AND EXISTS (
          SELECT 1 FROM organisation.institutional_operator_task_scope task_scope
           WHERE task_scope.operator_person_id = $1
             AND task_scope.organisation_id = $2
             AND task_scope.valid_from <= now()
             AND task_scope.valid_until > now()
        )`,
    [actor.personId, organisationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    organisationId: row.organisation_id,
    openP0P1AttentionCount: Number(row.open_p0_p1_attention_count),
    openExceptionCount: Number(row.open_exception_count),
    atRiskOrBlockedReadinessCount: Number(row.at_risk_or_blocked_readiness_count),
    openDataQualityIssueCount: Number(row.open_data_quality_issue_count),
    activeDisruptionCount: Number(row.active_disruption_count),
    latestServiceHealthStatus: row.latest_service_health_status,
    launchReadinessStatus: row.launch_readiness_status,
    activePilotStatus: row.active_pilot_status,
    exitPlanStatus: row.exit_plan_status,
    attentionItems: row.attention_items,
    transportExceptions: row.transport_exceptions,
    tenantScopedByAuthenticatedMembership: true,
    readScopedByCurrentOperatorTask: true,
    passengerManifestSafetyAndFinanceDetailExcluded: true,
    controlRoomMutationRequiresCurrentTaskScope: true,
    canonicalDomainTruthPreserved: true,
    mutationEnabled: false,
    externalExecutionEnabled: false
  };
}
