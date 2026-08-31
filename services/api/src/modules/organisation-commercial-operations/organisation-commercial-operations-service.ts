import {
  INSTITUTIONAL_APPROVAL_DECISIONS,
  INSTITUTIONAL_EVENT_CLASSIFICATIONS,
  ORGANISATION_AGREEMENT_STATES,
  ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS,
  ORGANISATION_COMMERCIAL_API_PATHS,
  ORGANISATION_COMMERCIAL_COMMANDS,
  ORGANISATION_COMMERCIAL_EVENTS,
  ORGANISATION_COMMERCIAL_P0_REQUIREMENTS,
  ORGANISATION_COMMERCIAL_RESTRICTION_SCOPES,
  ORGANISATION_CREDIT_STATES
} from '@dazat/domain';
import type {
  OrganisationCommercialCapabilitiesProjection,
  OrganisationCommercialContextProjection,
  OrganisationRenewalRiskSummaryProjection
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export function getOrganisationCommercialCapabilities(): OrganisationCommercialCapabilitiesProjection {
  return {
    agreementStates: ORGANISATION_AGREEMENT_STATES,
    approvalDecisions: INSTITUTIONAL_APPROVAL_DECISIONS,
    creditStates: ORGANISATION_CREDIT_STATES,
    restrictionScopes: ORGANISATION_COMMERCIAL_RESTRICTION_SCOPES,
    eventClassifications: INSTITUTIONAL_EVENT_CLASSIFICATIONS,
    conceptualApiPaths: ORGANISATION_COMMERCIAL_API_PATHS,
    conceptualCommands: ORGANISATION_COMMERCIAL_COMMANDS,
    events: ORGANISATION_COMMERCIAL_EVENTS,
    p0Requirements: ORGANISATION_COMMERCIAL_P0_REQUIREMENTS,
    acceptanceScenarios: ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS,
    contractAndOperationalStatusSeparated: true,
    agreementPolicyAndPricingVersionedSeparately: true,
    hardProtectionPrecedencePreserved: true,
    approvalCreatesDriverAssignment: false,
    billingConfigurationEditsLedger: false,
    organisationDebtChargesPassengerMethod: false,
    migrationLegacyBypassAllowed: false,
    organisationCommercialMutationsEnabled: false
  };
}

type OrganisationCommercialContextRow = {
  organisation_id: string;
  current_agreement_count: string;
  active_pricing_schedule_count: string;
  active_billing_account_count: string;
  pending_approval_count: string;
  current_credit_state: OrganisationCommercialContextProjection['currentCreditState'];
  open_service_case_count: string;
  pending_simulation_count: string;
  renewal_risk_count: string;
  renewal_risks: Array<{
    classificationId: string;
    bookingId: string;
    classification: OrganisationRenewalRiskSummaryProjection['classification'];
    classifiedBeforePickup: true;
    reasonCodes: string[];
  }>;
};

export async function getActorOrganisationCommercialContext(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  organisationId: string
): Promise<OrganisationCommercialContextProjection | null> {
  const result = await pool.query<OrganisationCommercialContextRow>(
    `SELECT organisation.id AS organisation_id,
            (SELECT count(*)::text FROM organisation.organisation_agreement agreement
              WHERE agreement.organisation_id = organisation.id AND agreement.status = 'ACTIVE'
                AND agreement.effective_start <= now()
                AND (agreement.effective_end IS NULL OR agreement.effective_end > now())) AS current_agreement_count,
            (SELECT count(*)::text FROM organisation.organisation_pricing_schedule_version pricing
              WHERE pricing.organisation_id = organisation.id AND pricing.status = 'ACTIVE'
                AND pricing.effective_from <= now()
                AND (pricing.effective_to IS NULL OR pricing.effective_to > now())) AS active_pricing_schedule_count,
            (SELECT count(*)::text FROM organisation.billing_account billing
              WHERE billing.organisation_id = organisation.id AND billing.status = 'ACTIVE') AS active_billing_account_count,
            (SELECT count(*)::text FROM organisation.organisation_approval_request approval
              WHERE approval.organisation_id = organisation.id AND approval.status = 'PENDING'
                AND approval.expires_at > now()) AS pending_approval_count,
            (SELECT credit.status FROM organisation.organisation_credit_status credit
              WHERE credit.organisation_id = organisation.id) AS current_credit_state,
            (SELECT count(*)::text FROM organisation.organisation_service_case service_case
              WHERE service_case.organisation_id = organisation.id
                AND service_case.status IN ('OPEN','IN_PROGRESS','WAITING')) AS open_service_case_count,
            (SELECT count(*)::text FROM organisation.contract_policy_simulation simulation
              WHERE simulation.organisation_id = organisation.id
                AND simulation.status IN ('PENDING','RUNNING')) AS pending_simulation_count,
            (SELECT count(*)::text FROM organisation.future_booking_contract_classification classification
              WHERE classification.organisation_id = organisation.id
                AND classification.classification IN ('RENEWAL_DEPENDENT','REAPPROVAL_REQUIRED','INVALID','MANUAL_REVIEW')) AS renewal_risk_count,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'classificationId', scoped.id,
                'bookingId', scoped.booking_id,
                'classification', scoped.classification,
                'classifiedBeforePickup', scoped.classified_before_pickup,
                'reasonCodes', scoped.reason_codes
              ) ORDER BY scoped.classified_at, scoped.id)
              FROM (SELECT * FROM organisation.future_booking_contract_classification classification
                     WHERE classification.organisation_id = organisation.id
                       AND classification.classification IN ('RENEWAL_DEPENDENT','REAPPROVAL_REQUIRED','INVALID','MANUAL_REVIEW')
                     ORDER BY classification.classified_at, classification.id LIMIT 50) scoped), '[]'::jsonb) AS renewal_risks
       FROM organisation.organisation_user_membership membership
       JOIN organisation.organisation organisation ON organisation.id = membership.organisation_id
      WHERE membership.person_id = $1
        AND membership.organisation_id = $2
        AND membership.status = 'ACTIVE'
        AND membership.valid_from <= now()
        AND (membership.valid_until IS NULL OR membership.valid_until > now())`,
    [actor.personId, organisationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    organisationId: row.organisation_id,
    currentAgreementCount: Number(row.current_agreement_count),
    activePricingScheduleCount: Number(row.active_pricing_schedule_count),
    activeBillingAccountCount: Number(row.active_billing_account_count),
    pendingApprovalCount: Number(row.pending_approval_count),
    currentCreditState: row.current_credit_state,
    openServiceCaseCount: Number(row.open_service_case_count),
    pendingSimulationCount: Number(row.pending_simulation_count),
    renewalRiskCount: Number(row.renewal_risk_count),
    renewalRisks: row.renewal_risks,
    tenantScopedByAuthenticatedMembership: true,
    passengerAndSafeguardingDataExcluded: true,
    canonicalFinanceAndBookingTruthPreserved: true,
    mutationEnabled: false,
    externalExecutionEnabled: false
  };
}
