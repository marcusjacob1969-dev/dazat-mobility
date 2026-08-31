import type {
  OrganisationAgreementState,
  OrganisationCommercialAcceptanceScenario,
  OrganisationCreditState
} from '@dazat/domain';

export interface OrganisationCommercialCapabilitiesProjection {
  readonly agreementStates: readonly OrganisationAgreementState[];
  readonly approvalDecisions: readonly string[];
  readonly creditStates: readonly OrganisationCreditState[];
  readonly restrictionScopes: readonly string[];
  readonly eventClassifications: readonly string[];
  readonly conceptualApiPaths: readonly string[];
  readonly conceptualCommands: readonly string[];
  readonly events: readonly string[];
  readonly p0Requirements: readonly string[];
  readonly acceptanceScenarios: readonly OrganisationCommercialAcceptanceScenario[];
  readonly contractAndOperationalStatusSeparated: true;
  readonly agreementPolicyAndPricingVersionedSeparately: true;
  readonly hardProtectionPrecedencePreserved: true;
  readonly approvalCreatesDriverAssignment: false;
  readonly billingConfigurationEditsLedger: false;
  readonly organisationDebtChargesPassengerMethod: false;
  readonly migrationLegacyBypassAllowed: false;
  readonly organisationCommercialMutationsEnabled: false;
}

export interface OrganisationRenewalRiskSummaryProjection {
  readonly classificationId: string;
  readonly bookingId: string;
  readonly classification: 'RENEWAL_DEPENDENT' | 'REAPPROVAL_REQUIRED' | 'INVALID' | 'MANUAL_REVIEW';
  readonly classifiedBeforePickup: true;
  readonly reasonCodes: readonly string[];
}

export interface OrganisationCommercialContextProjection {
  readonly organisationId: string;
  readonly currentAgreementCount: number;
  readonly activePricingScheduleCount: number;
  readonly activeBillingAccountCount: number;
  readonly pendingApprovalCount: number;
  readonly currentCreditState: OrganisationCreditState | null;
  readonly openServiceCaseCount: number;
  readonly pendingSimulationCount: number;
  readonly renewalRiskCount: number;
  readonly renewalRisks: readonly OrganisationRenewalRiskSummaryProjection[];
  readonly tenantScopedByAuthenticatedMembership: true;
  readonly passengerAndSafeguardingDataExcluded: true;
  readonly canonicalFinanceAndBookingTruthPreserved: true;
  readonly mutationEnabled: false;
  readonly externalExecutionEnabled: false;
}
