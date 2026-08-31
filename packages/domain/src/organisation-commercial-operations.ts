export const ORGANISATION_AGREEMENT_STATES = [
  'PROSPECT', 'DUE_DILIGENCE', 'DRAFT', 'INTERNAL_REVIEW', 'CUSTOMER_REVIEW',
  'APPROVED', 'ACTIVE', 'RENEWAL_DUE', 'RENEWED', 'VARIED', 'SUSPENDED',
  'EXPIRED', 'TERMINATED'
] as const;
export type OrganisationAgreementState = (typeof ORGANISATION_AGREEMENT_STATES)[number];

export const INSTITUTIONAL_APPROVAL_DECISIONS = [
  'AUTO_APPROVED', 'APPROVAL_REQUIRED', 'PRE_AUTHORISED', 'REVIEW_REQUIRED'
] as const;
export type InstitutionalApprovalDecision = (typeof INSTITUTIONAL_APPROVAL_DECISIONS)[number];

export const ORGANISATION_CREDIT_STATES = [
  'GOOD_STANDING', 'WATCH', 'CREDIT_LIMIT_REACHED',
  'RESTRICTED_FOR_NEW_BOOKINGS', 'SUSPENDED_FOR_NEW_BOOKINGS'
] as const;
export type OrganisationCreditState = (typeof ORGANISATION_CREDIT_STATES)[number];

export const ORGANISATION_COMMERCIAL_RESTRICTION_SCOPES = [
  'NEW_BOOKINGS_ONLY', 'NEW_RECURRING_SERIES', 'API_WRITES',
  'FINANCE_CREDIT', 'PORTAL_ADMIN_CHANGES', 'FULL_NEW_SERVICE'
] as const;

export const INSTITUTIONAL_EVENT_CLASSIFICATIONS = [
  'DRIVER_CANCELLED', 'PASSENGER_CANCELLED', 'ORGANISATION_CANCELLED',
  'PASSENGER_NOT_READY', 'NO_SHOW', 'SCHOOL_ABSENCE', 'TECHNICAL_FAILURE'
] as const;
export type InstitutionalEventClassification = (typeof INSTITUTIONAL_EVENT_CLASSIFICATIONS)[number];

export const ORGANISATION_COMMERCIAL_API_PATHS = [
  '/organisations/{id}/agreements', '/organisations/{id}/policies',
  '/organisations/{id}/approvals', '/organisations/{id}/billing-accounts',
  '/organisations/{id}/cost-centres', '/organisations/{id}/service-levels',
  '/organisations/{id}/reports', '/organisations/{id}/exports',
  '/organisations/{id}/api-clients', '/organisations/{id}/webhooks',
  '/organisations/{id}/support-cases', '/organisations/{id}/restrictions'
] as const;

export const ORGANISATION_COMMERCIAL_COMMANDS = [
  'ActivateOrganisationAgreement', 'CreateAgreementVersion',
  'ChangeOrganisationServicePolicy', 'SimulateOrganisationPolicy',
  'RequestBookingApproval', 'ApproveBookingFunding', 'RejectBookingFunding',
  'CreateOrganisationRestriction', 'LiftOrganisationRestriction',
  'TerminateOrganisationAgreement'
] as const;

export const ORGANISATION_COMMERCIAL_EVENTS = [
  'OrganisationAgreementActivated.v1', 'OrganisationAgreementExpiring.v1',
  'OrganisationAgreementExpired.v1', 'OrganisationPolicyChanged.v1',
  'OrganisationPolicySimulationCompleted.v1', 'BookingApprovalRequested.v1',
  'BookingApprovalGranted.v1', 'BookingApprovalRejected.v1',
  'OrganisationCreditStatusChanged.v1', 'OrganisationRestrictionApplied.v1',
  'OrganisationRestrictionLifted.v1', 'OrganisationServiceLevelMissed.v1',
  'OrganisationCorrectiveActionOpened.v1', 'OrganisationAPIClientCreated.v1',
  'OrganisationWebhookDeliveryFailed.v1', 'OrganisationAgreementTerminated.v1'
] as const;

export const ORGANISATION_COMMERCIAL_P0_REQUIREMENTS = [
  'ORG-AGR-001', 'ORG-AGR-002', 'ORG-POL-001', 'ORG-POL-002',
  'ORG-APR-001', 'ORG-APR-002', 'ORG-BIL-001', 'ORG-BIL-002',
  'ORG-CRD-001', 'ORG-PRT-001', 'ORG-SLA-001', 'ORG-SLA-002',
  'ORG-API-001', 'ORG-API-002', 'ORG-EXP-001', 'ORG-SEC-001',
  'ORG-CHG-001', 'ORG-TERM-001', 'ORG-REN-001', 'ORG-MIG-001'
] as const;

export const ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS = [
  'EFFECTIVE_DATED_AGREEMENT_VERSION', 'WAV_POLICY_DOWNGRADE_REJECTED',
  'APPROVAL_DOES_NOT_ASSIGN_DRIVER', 'BREAKDOWN_BYPASSES_COMMERCIAL_DELAY',
  'MISSING_PO_NEVER_CHARGES_PASSENGER', 'CREDIT_LIMIT_PRESERVES_ACTIVE_TRIP',
  'FINANCE_ROLE_DENIED_SAFEGUARDING', 'HISTORICAL_SLA_REPRODUCIBLE',
  'ALLEGATION_IS_NOT_AUTOMATIC_GUILT', 'CONTRACT_CHANGE_SIMULATION_1000_BOOKINGS',
  'API_SECRET_ROTATION_REVOKES_OLD', 'API_BOOKING_REPLAY_DEDUPLICATED',
  'WEBHOOK_REPLAY_DEDUPLICATED', 'SENSITIVE_LOCATION_EXPORT_DENIED',
  'EXPIRY_RISK_PRE_SERVICE', 'TERMINATION_PRESERVES_ACTIVE_AND_FINANCE',
  'REINSTATEMENT_REVALIDATES', 'LEGACY_APPROVED_FLAG_CANNOT_BYPASS',
  'NOT_READY_PORTAL_RECLASSIFICATION_REJECTED'
] as const;
export type OrganisationCommercialAcceptanceScenario = (typeof ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS)[number];

export function evaluateAgreementVersion(input: {
  readonly contractStatus: OrganisationAgreementState;
  readonly organisationOperationalStatusEvaluatedSeparately: boolean;
  readonly agreementDocumentVersioned: boolean;
  readonly servicePolicyVersionedSeparately: boolean;
  readonly pricingScheduleVersionedSeparately: boolean;
  readonly effectiveAt: string;
  readonly evaluatedAt: string;
  readonly historicalTermsRewritten: boolean;
  readonly futureBookingsClassifiedBeforeExpiry: boolean;
  readonly retentionObligationsPreserved: boolean;
}): { readonly usableNow: boolean; readonly blockers: readonly string[]; readonly historicalTermsMutable: false } {
  const blockers: string[] = [];
  if (!input.organisationOperationalStatusEvaluatedSeparately) blockers.push('CONTRACT_AND_OPERATIONAL_STATUS_MUST_REMAIN_SEPARATE');
  if (!input.agreementDocumentVersioned || !input.servicePolicyVersionedSeparately || !input.pricingScheduleVersionedSeparately) {
    blockers.push('AGREEMENT_POLICY_PRICING_SEPARATION_REQUIRED');
  }
  const effectiveAt = Date.parse(input.effectiveAt);
  const evaluatedAt = Date.parse(input.evaluatedAt);
  if (!Number.isFinite(effectiveAt) || !Number.isFinite(evaluatedAt)) throw new Error('Agreement timestamps must be valid ISO-compatible values');
  if (input.historicalTermsRewritten) blockers.push('HISTORICAL_AGREEMENT_REWRITE_PROHIBITED');
  if (!input.futureBookingsClassifiedBeforeExpiry) blockers.push('FUTURE_BOOKING_EXPIRY_CLASSIFICATION_REQUIRED');
  if (!input.retentionObligationsPreserved) blockers.push('LAWFUL_RETENTION_MUST_PERSIST');
  const usableNow = blockers.length === 0 && input.contractStatus === 'ACTIVE' && effectiveAt <= evaluatedAt;
  return { usableNow, blockers, historicalTermsMutable: false };
}

export function evaluateOrganisationPolicyPrecedence(input: {
  readonly legalRulesSatisfied: boolean;
  readonly safetySafeguardingAccessibilityPreserved: boolean;
  readonly platformEligibilitySatisfied: boolean;
  readonly bookingAuthoritySatisfied: boolean;
  readonly passengerServiceEligibilitySatisfied: boolean;
  readonly fundingApprovalSatisfied: boolean;
  readonly commercialPreferenceSatisfied: boolean;
  readonly pricingTreatmentAvailable: boolean;
  readonly policyWouldDowngradeRequiredService: boolean;
  readonly signedAgreementConflictPresent: boolean;
}): { readonly action: 'ALLOW' | 'OPEN_CONTROLLED_REVIEW' | 'DENY'; readonly blockers: readonly string[]; readonly hardRequirementsDowngraded: false } {
  const blockers: string[] = [];
  if (!input.legalRulesSatisfied) blockers.push('LEGAL_OR_REGULATORY_RULE_FAILED');
  if (!input.safetySafeguardingAccessibilityPreserved || input.policyWouldDowngradeRequiredService) blockers.push('HARD_PROTECTION_DOWNGRADE_PROHIBITED');
  if (!input.platformEligibilitySatisfied) blockers.push('PLATFORM_ELIGIBILITY_REQUIRED');
  if (!input.bookingAuthoritySatisfied) blockers.push('BOOKING_AUTHORITY_REQUIRED');
  if (!input.passengerServiceEligibilitySatisfied) blockers.push('PASSENGER_SERVICE_ELIGIBILITY_REQUIRED');
  if (!input.fundingApprovalSatisfied) blockers.push('FUNDING_OR_APPROVAL_REQUIRED');
  if (!input.commercialPreferenceSatisfied) blockers.push('COMMERCIAL_POLICY_EXCEPTION');
  if (!input.pricingTreatmentAvailable) blockers.push('PRICING_TREATMENT_UNAVAILABLE');
  if (input.signedAgreementConflictPresent) blockers.push('AGREEMENT_POLICY_CONFLICT_REQUIRES_REVIEW');
  const reviewOnly = blockers.every((blocker) => ['COMMERCIAL_POLICY_EXCEPTION', 'PRICING_TREATMENT_UNAVAILABLE', 'AGREEMENT_POLICY_CONFLICT_REQUIRES_REVIEW'].includes(blocker));
  return { action: blockers.length === 0 ? 'ALLOW' : reviewOnly ? 'OPEN_CONTROLLED_REVIEW' : 'DENY', blockers, hardRequirementsDowngraded: false };
}

export function evaluateInstitutionalApproval(input: {
  readonly decision: InstitutionalApprovalDecision;
  readonly requesterAuthorised: boolean;
  readonly approverInScope: boolean;
  readonly policyVersionRecorded: boolean;
  readonly conditionsRecorded: boolean;
  readonly dualApprovalRequired: boolean;
  readonly dualApprovalSatisfied: boolean;
  readonly bookingAuthoritySatisfied: boolean;
  readonly fundingAuthoritySatisfied: boolean;
  readonly currentBookingAndDispatchValidationSatisfied: boolean;
  readonly driverAssignmentCreatedByApproval: boolean;
}): { readonly action: 'CONTINUE_CANONICAL_BOOKING' | 'WAIT_FOR_APPROVAL' | 'DENY'; readonly approvalCreatesAssignment: false } {
  if (!input.requesterAuthorised || !input.approverInScope || !input.policyVersionRecorded || !input.conditionsRecorded) {
    return { action: 'DENY', approvalCreatesAssignment: false };
  }
  if (input.dualApprovalRequired && !input.dualApprovalSatisfied) return { action: 'WAIT_FOR_APPROVAL', approvalCreatesAssignment: false };
  if (input.decision === 'APPROVAL_REQUIRED' || input.decision === 'REVIEW_REQUIRED') return { action: 'WAIT_FOR_APPROVAL', approvalCreatesAssignment: false };
  const authoritiesPass = input.bookingAuthoritySatisfied && input.fundingAuthoritySatisfied;
  if (!authoritiesPass || !input.currentBookingAndDispatchValidationSatisfied || input.driverAssignmentCreatedByApproval) {
    return { action: 'DENY', approvalCreatesAssignment: false };
  }
  return { action: 'CONTINUE_CANONICAL_BOOKING', approvalCreatesAssignment: false };
}

export function evaluateUrgentCommercialException(input: {
  readonly activePassenger: boolean;
  readonly safetyBreakdownOrSafeguardingNeed: boolean;
  readonly ordinaryCommercialApprovalOutstanding: boolean;
  readonly governedEmergencyAuthorityPresent: boolean;
  readonly operationalOrSafetyExceptionRecorded: boolean;
  readonly commercialApprovalFalsified: boolean;
  readonly financeReconciliationDeferred: boolean;
}): { readonly action: 'PROCEED_CONTINUITY' | 'DENY'; readonly ordinaryApprovalGranted: false } {
  const mayProceed = input.activePassenger && input.safetyBreakdownOrSafeguardingNeed
    && input.ordinaryCommercialApprovalOutstanding
    && input.governedEmergencyAuthorityPresent && input.operationalOrSafetyExceptionRecorded
    && !input.commercialApprovalFalsified && input.financeReconciliationDeferred;
  return { action: mayProceed ? 'PROCEED_CONTINUITY' : 'DENY', ordinaryApprovalGranted: false };
}

export function evaluateInstitutionalBilling(input: {
  readonly billingAccountCurrent: boolean;
  readonly costCentreOrProgrammeCurrent: boolean;
  readonly structuredReferenceRequired: boolean;
  readonly structuredReferencePresent: boolean;
  readonly urgentExceptionApplies: boolean;
  readonly canonicalFinanceEngineUsed: boolean;
  readonly directLedgerEditRequested: boolean;
  readonly historicalInvoiceRewriteRequested: boolean;
  readonly passengerPersonalPaymentFallbackRequested: boolean;
  readonly invoiceDataMinimised: boolean;
}): { readonly action: 'ALLOW_FINANCE_PREPARATION' | 'OPEN_FUNDING_EXCEPTION' | 'DENY'; readonly passengerLiabilityCreated: false; readonly ledgerEdited: false } {
  if (input.directLedgerEditRequested || input.historicalInvoiceRewriteRequested || input.passengerPersonalPaymentFallbackRequested || !input.canonicalFinanceEngineUsed || !input.invoiceDataMinimised) {
    return { action: 'DENY', passengerLiabilityCreated: false, ledgerEdited: false };
  }
  const missingFunding = !input.billingAccountCurrent || !input.costCentreOrProgrammeCurrent
    || (input.structuredReferenceRequired && !input.structuredReferencePresent && !input.urgentExceptionApplies);
  return { action: missingFunding ? 'OPEN_FUNDING_EXCEPTION' : 'ALLOW_FINANCE_PREPARATION', passengerLiabilityCreated: false, ledgerEdited: false };
}

export function evaluateOrganisationCreditControl(input: {
  readonly state: OrganisationCreditState;
  readonly activeJourney: boolean;
  readonly safetyOrContinuityAction: boolean;
  readonly newOrdinaryBooking: boolean;
  readonly futureBookingsSurfacedBeforePickup: boolean;
  readonly manualOverrideRequested: boolean;
  readonly overrideReasonedTimeLimitedAudited: boolean;
  readonly passengerPersonalMethodChargeRequested: boolean;
}): { readonly activeServiceContinues: boolean; readonly newBookingAllowed: boolean; readonly personalChargeAllowed: false } {
  const restricted = ['CREDIT_LIMIT_REACHED', 'RESTRICTED_FOR_NEW_BOOKINGS', 'SUSPENDED_FOR_NEW_BOOKINGS'].includes(input.state);
  const activeServiceContinues = input.activeJourney || input.safetyOrContinuityAction;
  const overrideValid = input.manualOverrideRequested && input.overrideReasonedTimeLimitedAudited;
  const futureBookingRiskHandled = !restricted || input.futureBookingsSurfacedBeforePickup;
  return {
    activeServiceContinues,
    newBookingAllowed: input.newOrdinaryBooking && (!restricted || overrideValid)
      && futureBookingRiskHandled && !input.passengerPersonalMethodChargeRequested,
    personalChargeAllowed: false
  };
}

export function evaluateServiceLevelMeasurement(input: {
  readonly metricDefinitionVersioned: boolean;
  readonly populationWindowTargetAndSourceRecorded: boolean;
  readonly historicalMetricVersionRetained: boolean;
  readonly cause: 'PASSENGER_NOT_READY' | 'SITE_ACCESS' | 'ROAD_CLOSURE' | 'PLATFORM_DISPATCH' | 'PROVIDER_FAILURE' | 'DRIVER' | 'UNKNOWN';
  readonly staleGpsUsedAsProof: boolean;
  readonly safetyIncidentSuppressed: boolean;
  readonly dataQualityLimitationsDisclosed: boolean;
  readonly serviceCreditRequired: boolean;
  readonly serviceCreditCreatedByFinance: boolean;
}): { readonly reportable: boolean; readonly classificationRewritten: false } {
  return {
    reportable: input.metricDefinitionVersioned && input.populationWindowTargetAndSourceRecorded
      && input.historicalMetricVersionRetained && input.cause !== 'UNKNOWN'
      && !input.staleGpsUsedAsProof && !input.safetyIncidentSuppressed
      && input.dataQualityLimitationsDisclosed
      && (!input.serviceCreditRequired || input.serviceCreditCreatedByFinance),
    classificationRewritten: false
  };
}

export function evaluateOrganisationAllegation(input: {
  readonly allegationRecordedAsEvidence: boolean;
  readonly routedToCanonicalSafetySupportOrConductWorkflow: boolean;
  readonly automaticDriverGuiltApplied: boolean;
  readonly automaticPunishmentApplied: boolean;
  readonly organisationGivenUnrestrictedCaseAccess: boolean;
  readonly correctiveActionOwnerActionDeadlineEvidenceOutcomeRecorded: boolean;
}): { readonly allowed: boolean; readonly findingCreatedByAllegation: false } {
  return {
    allowed: input.allegationRecordedAsEvidence && input.routedToCanonicalSafetySupportOrConductWorkflow
      && !input.automaticDriverGuiltApplied && !input.automaticPunishmentApplied
      && !input.organisationGivenUnrestrictedCaseAccess
      && input.correctiveActionOwnerActionDeadlineEvidenceOutcomeRecorded,
    findingCreatedByAllegation: false
  };
}

export function evaluateContractPolicySimulation(input: {
  readonly proposedVersionAndEffectiveDateRecorded: boolean;
  readonly impactedFutureBookingsCount: number;
  readonly everyImpactClassified: boolean;
  readonly completedJourneysRewritten: boolean;
  readonly activeJourneyInvalidated: boolean;
  readonly accessibilityOrSafeguardingDowngrade: boolean;
  readonly productionWritesPerformed: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly productionMutated: false } {
  const blockers: string[] = [];
  if (!input.proposedVersionAndEffectiveDateRecorded) blockers.push('PROPOSED_VERSION_AND_EFFECTIVE_DATE_REQUIRED');
  if (!Number.isSafeInteger(input.impactedFutureBookingsCount) || input.impactedFutureBookingsCount < 0) throw new Error('Impacted booking count must be a non-negative safe integer');
  if (!input.everyImpactClassified) blockers.push('EVERY_FUTURE_BOOKING_IMPACT_MUST_BE_CLASSIFIED');
  if (input.completedJourneysRewritten) blockers.push('COMPLETED_JOURNEY_REWRITE_PROHIBITED');
  if (input.activeJourneyInvalidated) blockers.push('ACTIVE_JOURNEY_INVALIDATION_PROHIBITED');
  if (input.accessibilityOrSafeguardingDowngrade) blockers.push('HARD_REQUIREMENT_DOWNGRADE_PROHIBITED');
  if (input.productionWritesPerformed) blockers.push('SIMULATION_MUST_NOT_WRITE_PRODUCTION_STATE');
  return { allowed: blockers.length === 0, blockers, productionMutated: false };
}

export function evaluateOrganisationIntegration(input: {
  readonly tenantBoundScopes: boolean;
  readonly credentialSecretReturnedAfterCreation: boolean;
  readonly rotatedOldCredentialAccepted: boolean;
  readonly idempotencyKeyPresent: boolean;
  readonly replayCreatedDuplicateBooking: boolean;
  readonly webhookSigned: boolean;
  readonly stableEventIdPresent: boolean;
  readonly duplicateAndOutOfOrderHandlingPresent: boolean;
  readonly payloadPrivacyMinimised: boolean;
  readonly anomalyAndRateControlsPresent: boolean;
}): { readonly allowed: boolean; readonly replayDeduplicated: boolean } {
  const replayDeduplicated = input.idempotencyKeyPresent && !input.replayCreatedDuplicateBooking;
  return {
    allowed: input.tenantBoundScopes && !input.credentialSecretReturnedAfterCreation
      && !input.rotatedOldCredentialAccepted && replayDeduplicated && input.webhookSigned
      && input.stableEventIdPresent && input.duplicateAndOutOfOrderHandlingPresent
      && input.payloadPrivacyMinimised && input.anomalyAndRateControlsPresent,
    replayDeduplicated
  };
}

export function organisationCommercialExportMayRun(input: {
  readonly tenantRolePurposeScoped: boolean;
  readonly requestedDataNecessary: boolean;
  readonly includesRawSafetyOrSafeguarding: boolean;
  readonly includesDiagnosisCallRecordingOrUnrelatedHistory: boolean;
  readonly largeOrSensitive: boolean;
  readonly stepUpOrApprovalSatisfied: boolean;
  readonly exportHistoryRecorded: boolean;
  readonly crossTenantDataPresent: boolean;
}): boolean {
  return input.tenantRolePurposeScoped && input.requestedDataNecessary
    && !input.includesRawSafetyOrSafeguarding && !input.includesDiagnosisCallRecordingOrUnrelatedHistory
    && (!input.largeOrSensitive || input.stepUpOrApprovalSatisfied)
    && input.exportHistoryRecorded && !input.crossTenantDataPresent;
}

export function evaluateOrganisationExitOrReinstatement(input: {
  readonly action: 'SUSPEND' | 'TERMINATE' | 'REINSTATE';
  readonly restrictionScopeRecorded: boolean;
  readonly activeJourneysContinueSafely: boolean;
  readonly futureBookingDispositionRecorded: boolean;
  readonly financeSafetySafeguardingAuditRetained: boolean;
  readonly oldApiCredentialsBlindlyRestored: boolean;
  readonly agreementCreditSecurityDocumentsContactsRevalidated: boolean;
}): { readonly allowed: boolean; readonly destructiveHistoryLoss: false } {
  const revalidationOkay = input.action !== 'REINSTATE'
    || (input.agreementCreditSecurityDocumentsContactsRevalidated && !input.oldApiCredentialsBlindlyRestored);
  return {
    allowed: input.restrictionScopeRecorded && input.activeJourneysContinueSafely
      && input.futureBookingDispositionRecorded && input.financeSafetySafeguardingAuditRetained
      && revalidationOkay,
    destructiveHistoryLoss: false
  };
}

export function evaluateOrganisationMigration(input: {
  readonly dryRunCompleted: boolean;
  readonly mappingAndDuplicateChecksCompleted: boolean;
  readonly rowLevelOutcomesVisible: boolean;
  readonly sensitiveDataMinimised: boolean;
  readonly sourceOfTruthCutoverRecorded: boolean;
  readonly legacyApprovedDriverFlagTrusted: boolean;
  readonly legacySafePassengerFlagTrusted: boolean;
  readonly currentEligibilitySafetySecurityRevalidated: boolean;
}): { readonly allowed: boolean; readonly legacyBypassAccepted: false } {
  return {
    allowed: input.dryRunCompleted && input.mappingAndDuplicateChecksCompleted
      && input.rowLevelOutcomesVisible && input.sensitiveDataMinimised
      && input.sourceOfTruthCutoverRecorded && !input.legacyApprovedDriverFlagTrusted
      && !input.legacySafePassengerFlagTrusted && input.currentEligibilitySafetySecurityRevalidated,
    legacyBypassAccepted: false
  };
}

export function evaluateOrganisationPortalAccess(input: {
  readonly authenticatedMembershipCurrent: boolean;
  readonly tenantScopeMatches: boolean;
  readonly backendRolePermissionSatisfied: boolean;
  readonly uiElementVisible: boolean;
  readonly financeRoleRequestedSafeguardingData: boolean;
  readonly internalDazatPrivilegeRequested: boolean;
  readonly searchScopedBeforeExecution: boolean;
}): { readonly allowed: boolean; readonly uiVisibilityIsAuthority: false } {
  return {
    allowed: input.authenticatedMembershipCurrent && input.tenantScopeMatches
      && input.backendRolePermissionSatisfied && !input.financeRoleRequestedSafeguardingData
      && !input.internalDazatPrivilegeRequested && input.searchScopedBeforeExecution,
    uiVisibilityIsAuthority: false
  };
}

export function evaluateContractualRemedy(input: {
  readonly canonicalClassification: InstitutionalEventClassification;
  readonly requestedClassification: InstitutionalEventClassification;
  readonly accessibilityDelayMisclassifiedAsNoShow: boolean;
  readonly safeguardingFailureMisclassifiedAsNoShow: boolean;
  readonly financeRuleUsesCanonicalClassification: boolean;
  readonly originalFareAndLedgerHistoryPreserved: boolean;
  readonly serviceCreditDistinctFromRefundPromotionAndDriverAdjustment: boolean;
}): { readonly allowed: boolean; readonly classificationRewritten: false } {
  return {
    allowed: input.canonicalClassification === input.requestedClassification
      && !input.accessibilityDelayMisclassifiedAsNoShow
      && !input.safeguardingFailureMisclassifiedAsNoShow
      && input.financeRuleUsesCanonicalClassification
      && input.originalFareAndLedgerHistoryPreserved
      && input.serviceCreditDistinctFromRefundPromotionAndDriverAdjustment,
    classificationRewritten: false
  };
}

export function organisationCommercialAcceptanceScenarioMayPass(input: {
  readonly scenario: OrganisationCommercialAcceptanceScenario;
  readonly historicalVersionsPreserved: boolean;
  readonly hardProtectionPrecedencePreserved: boolean;
  readonly canonicalBookingDispatchJourneyFinanceUsed: boolean;
  readonly passengerPersonalLiabilityNotCreated: boolean;
  readonly tenantRolePurposeScopePreserved: boolean;
  readonly activePassengerContinuityPreserved: boolean;
  readonly idempotencyAndAuditEvidencePresent: boolean;
  readonly legacyOrCommercialBypassUsed: boolean;
}): boolean {
  return ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS.includes(input.scenario)
    && input.historicalVersionsPreserved && input.hardProtectionPrecedencePreserved
    && input.canonicalBookingDispatchJourneyFinanceUsed
    && input.passengerPersonalLiabilityNotCreated && input.tenantRolePurposeScopePreserved
    && input.activePassengerContinuityPreserved && input.idempotencyAndAuditEvidencePresent
    && !input.legacyOrCommercialBypassUsed;
}

export const COMMERCIAL_CONTRACT_OVERRIDES_HARD_PROTECTION = false as const;
export const AGREEMENT_DOCUMENT_IS_OPERATIONAL_POLICY = false as const;
export const APPROVAL_CREATES_DRIVER_ASSIGNMENT = false as const;
export const COST_CENTRE_OR_REFERENCE_EDITS_LEDGER = false as const;
export const ORGANISATION_DEBT_CHARGES_PASSENGER_METHOD = false as const;
export const SLA_MAY_REWRITE_CANONICAL_CLASSIFICATION = false as const;
export const ORGANISATION_ALLEGATION_CREATES_AUTOMATIC_GUILT = false as const;
export const MIGRATION_LEGACY_FLAGS_BYPASS_CURRENT_ELIGIBILITY = false as const;
export const ORGANISATION_COMMERCIAL_MUTATIONS_ENABLED = false as const;
