import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGREEMENT_DOCUMENT_IS_OPERATIONAL_POLICY,
  APPROVAL_CREATES_DRIVER_ASSIGNMENT,
  COMMERCIAL_CONTRACT_OVERRIDES_HARD_PROTECTION,
  COST_CENTRE_OR_REFERENCE_EDITS_LEDGER,
  evaluateAgreementVersion,
  evaluateContractPolicySimulation,
  evaluateContractualRemedy,
  evaluateInstitutionalApproval,
  evaluateInstitutionalBilling,
  evaluateOrganisationAllegation,
  evaluateOrganisationCreditControl,
  evaluateOrganisationExitOrReinstatement,
  evaluateOrganisationIntegration,
  evaluateOrganisationMigration,
  evaluateOrganisationPolicyPrecedence,
  evaluateOrganisationPortalAccess,
  evaluateServiceLevelMeasurement,
  evaluateUrgentCommercialException,
  INSTITUTIONAL_APPROVAL_DECISIONS,
  INSTITUTIONAL_EVENT_CLASSIFICATIONS,
  MIGRATION_LEGACY_FLAGS_BYPASS_CURRENT_ELIGIBILITY,
  ORGANISATION_AGREEMENT_STATES,
  ORGANISATION_ALLEGATION_CREATES_AUTOMATIC_GUILT,
  ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS,
  ORGANISATION_COMMERCIAL_API_PATHS,
  ORGANISATION_COMMERCIAL_COMMANDS,
  ORGANISATION_COMMERCIAL_EVENTS,
  ORGANISATION_COMMERCIAL_MUTATIONS_ENABLED,
  ORGANISATION_COMMERCIAL_P0_REQUIREMENTS,
  ORGANISATION_COMMERCIAL_RESTRICTION_SCOPES,
  organisationCommercialAcceptanceScenarioMayPass,
  organisationCommercialExportMayRun,
  ORGANISATION_CREDIT_STATES,
  ORGANISATION_DEBT_CHARGES_PASSENGER_METHOD,
  SLA_MAY_REWRITE_CANONICAL_CLASSIFICATION
} from '../../packages/domain/src/organisation-commercial-operations.ts';

const activeAgreement = {
  contractStatus: 'ACTIVE', organisationOperationalStatusEvaluatedSeparately: true,
  agreementDocumentVersioned: true, servicePolicyVersionedSeparately: true,
  pricingScheduleVersionedSeparately: true, effectiveAt: '2026-08-01T00:00:00Z',
  evaluatedAt: '2026-08-31T00:00:00Z', historicalTermsRewritten: false,
  futureBookingsClassifiedBeforeExpiry: true, retentionObligationsPreserved: true
};

test('effective-dated agreement is usable without rewriting historical terms', () => {
  const result = evaluateAgreementVersion(activeAgreement);
  assert.equal(result.usableNow, true);
  assert.equal(result.historicalTermsMutable, false);
});

test('agreement, policy and pricing must remain separate versioned truth', () => {
  const result = evaluateAgreementVersion({ ...activeAgreement, pricingScheduleVersionedSeparately: false });
  assert.equal(result.usableNow, false);
  assert.ok(result.blockers.includes('AGREEMENT_POLICY_PRICING_SEPARATION_REQUIRED'));
});

test('contract status never replaces operational organisation status', () => {
  const result = evaluateAgreementVersion({ ...activeAgreement, organisationOperationalStatusEvaluatedSeparately: false });
  assert.ok(result.blockers.includes('CONTRACT_AND_OPERATIONAL_STATUS_MUST_REMAIN_SEPARATE'));
});

const validPolicy = {
  legalRulesSatisfied: true, safetySafeguardingAccessibilityPreserved: true,
  platformEligibilitySatisfied: true, bookingAuthoritySatisfied: true,
  passengerServiceEligibilitySatisfied: true, fundingApprovalSatisfied: true,
  commercialPreferenceSatisfied: true, pricingTreatmentAvailable: true,
  policyWouldDowngradeRequiredService: false, signedAgreementConflictPresent: false
};

test('commercial policy evaluates only after every hard protection', () => {
  assert.equal(evaluateOrganisationPolicyPrecedence(validPolicy).action, 'ALLOW');
});

test('cheaper policy cannot remove a passenger WAV requirement', () => {
  const result = evaluateOrganisationPolicyPrecedence({ ...validPolicy, policyWouldDowngradeRequiredService: true });
  assert.equal(result.action, 'DENY');
  assert.equal(result.hardRequirementsDowngraded, false);
});

test('agreement-policy conflict opens controlled review', () => {
  const result = evaluateOrganisationPolicyPrecedence({ ...validPolicy, signedAgreementConflictPresent: true });
  assert.equal(result.action, 'OPEN_CONTROLLED_REVIEW');
});

const validApproval = {
  decision: 'AUTO_APPROVED', requesterAuthorised: true, approverInScope: true,
  policyVersionRecorded: true, conditionsRecorded: true, dualApprovalRequired: false,
  dualApprovalSatisfied: false, bookingAuthoritySatisfied: true,
  fundingAuthoritySatisfied: true, currentBookingAndDispatchValidationSatisfied: true,
  driverAssignmentCreatedByApproval: false
};

test('approval continues through canonical Booking and Dispatch without assigning a driver', () => {
  const result = evaluateInstitutionalApproval(validApproval);
  assert.equal(result.action, 'CONTINUE_CANONICAL_BOOKING');
  assert.equal(result.approvalCreatesAssignment, false);
});

test('dual approval waits until independently satisfied', () => {
  const result = evaluateInstitutionalApproval({ ...validApproval, dualApprovalRequired: true });
  assert.equal(result.action, 'WAIT_FOR_APPROVAL');
});

test('approval cannot bypass current Booking or Dispatch validation', () => {
  const result = evaluateInstitutionalApproval({ ...validApproval, currentBookingAndDispatchValidationSatisfied: false });
  assert.equal(result.action, 'DENY');
});

test('active-passenger breakdown continuity outranks unresolved PO approval', () => {
  const result = evaluateUrgentCommercialException({
    activePassenger: true, safetyBreakdownOrSafeguardingNeed: true,
    ordinaryCommercialApprovalOutstanding: true, governedEmergencyAuthorityPresent: true,
    operationalOrSafetyExceptionRecorded: true, commercialApprovalFalsified: false,
    financeReconciliationDeferred: true
  });
  assert.equal(result.action, 'PROCEED_CONTINUITY');
  assert.equal(result.ordinaryApprovalGranted, false);
});

const validBilling = {
  billingAccountCurrent: true, costCentreOrProgrammeCurrent: true,
  structuredReferenceRequired: true, structuredReferencePresent: true,
  urgentExceptionApplies: false, canonicalFinanceEngineUsed: true,
  directLedgerEditRequested: false, historicalInvoiceRewriteRequested: false,
  passengerPersonalPaymentFallbackRequested: false, invoiceDataMinimised: true
};

test('structured billing data prepares canonical Finance without owning ledger truth', () => {
  const result = evaluateInstitutionalBilling(validBilling);
  assert.equal(result.action, 'ALLOW_FINANCE_PREPARATION');
  assert.equal(result.ledgerEdited, false);
});

test('missing PO opens funding exception without passenger liability', () => {
  const result = evaluateInstitutionalBilling({ ...validBilling, structuredReferencePresent: false });
  assert.equal(result.action, 'OPEN_FUNDING_EXCEPTION');
  assert.equal(result.passengerLiabilityCreated, false);
});

test('direct invoice or ledger rewriting is denied', () => {
  assert.equal(evaluateInstitutionalBilling({ ...validBilling, directLedgerEditRequested: true }).action, 'DENY');
});

test('credit limit preserves active trip while restricting new ordinary booking', () => {
  const result = evaluateOrganisationCreditControl({
    state: 'CREDIT_LIMIT_REACHED', activeJourney: true, safetyOrContinuityAction: false,
    newOrdinaryBooking: true, futureBookingsSurfacedBeforePickup: true,
    manualOverrideRequested: false, overrideReasonedTimeLimitedAudited: false,
    passengerPersonalMethodChargeRequested: false
  });
  assert.equal(result.activeServiceContinues, true);
  assert.equal(result.newBookingAllowed, false);
  assert.equal(result.personalChargeAllowed, false);
  assert.equal(evaluateOrganisationCreditControl({
    state: 'SUSPENDED_FOR_NEW_BOOKINGS', activeJourney: true, safetyOrContinuityAction: false,
    newOrdinaryBooking: false, futureBookingsSurfacedBeforePickup: false,
    manualOverrideRequested: false, overrideReasonedTimeLimitedAudited: false,
    passengerPersonalMethodChargeRequested: false
  }).activeServiceContinues, true);
});

test('manual credit override is usable only when reasoned time-limited and audited', () => {
  const result = evaluateOrganisationCreditControl({
    state: 'RESTRICTED_FOR_NEW_BOOKINGS', activeJourney: false, safetyOrContinuityAction: false,
    newOrdinaryBooking: true, futureBookingsSurfacedBeforePickup: true,
    manualOverrideRequested: true, overrideReasonedTimeLimitedAudited: true,
    passengerPersonalMethodChargeRequested: false
  });
  assert.equal(result.newBookingAllowed, true);
});

const validSla = {
  metricDefinitionVersioned: true, populationWindowTargetAndSourceRecorded: true,
  historicalMetricVersionRetained: true, cause: 'PLATFORM_DISPATCH',
  staleGpsUsedAsProof: false, safetyIncidentSuppressed: false,
  dataQualityLimitationsDisclosed: true, serviceCreditRequired: false,
  serviceCreditCreatedByFinance: false
};

test('SLA result remains reproducible under its metric version and cause', () => {
  assert.equal(evaluateServiceLevelMeasurement(validSla).reportable, true);
  assert.equal(evaluateServiceLevelMeasurement({ ...validSla, serviceCreditRequired: true }).reportable, false);
});

test('stale GPS cannot prove lateness or no-show', () => {
  const result = evaluateServiceLevelMeasurement({ ...validSla, staleGpsUsedAsProof: true });
  assert.equal(result.reportable, false);
  assert.equal(result.classificationRewritten, false);
});

test('organisation allegation is evidence and never automatic guilt', () => {
  const result = evaluateOrganisationAllegation({
    allegationRecordedAsEvidence: true, routedToCanonicalSafetySupportOrConductWorkflow: true,
    automaticDriverGuiltApplied: false, automaticPunishmentApplied: false,
    organisationGivenUnrestrictedCaseAccess: false,
    correctiveActionOwnerActionDeadlineEvidenceOutcomeRecorded: true
  });
  assert.equal(result.allowed, true);
  assert.equal(result.findingCreatedByAllegation, false);
});

test('contract simulation classifies 1000 future bookings without production writes', () => {
  const result = evaluateContractPolicySimulation({
    proposedVersionAndEffectiveDateRecorded: true, impactedFutureBookingsCount: 1000,
    everyImpactClassified: true, completedJourneysRewritten: false,
    activeJourneyInvalidated: false, accessibilityOrSafeguardingDowngrade: false,
    productionWritesPerformed: false
  });
  assert.equal(result.allowed, true);
  assert.equal(result.productionMutated, false);
});

test('policy simulation cannot invalidate an active Journey', () => {
  const result = evaluateContractPolicySimulation({
    proposedVersionAndEffectiveDateRecorded: true, impactedFutureBookingsCount: 1,
    everyImpactClassified: true, completedJourneysRewritten: false,
    activeJourneyInvalidated: true, accessibilityOrSafeguardingDowngrade: false,
    productionWritesPerformed: false
  });
  assert.ok(result.blockers.includes('ACTIVE_JOURNEY_INVALIDATION_PROHIBITED'));
});

const validIntegration = {
  tenantBoundScopes: true, credentialSecretReturnedAfterCreation: false,
  rotatedOldCredentialAccepted: false, idempotencyKeyPresent: true,
  replayCreatedDuplicateBooking: false, webhookSigned: true, stableEventIdPresent: true,
  duplicateAndOutOfOrderHandlingPresent: true, payloadPrivacyMinimised: true,
  anomalyAndRateControlsPresent: true
};

test('rotated tenant API and signed webhook controls pass together', () => {
  const result = evaluateOrganisationIntegration(validIntegration);
  assert.equal(result.allowed, true);
  assert.equal(result.replayDeduplicated, true);
});

test('old credential acceptance fails closed after rotation', () => {
  assert.equal(evaluateOrganisationIntegration({ ...validIntegration, rotatedOldCredentialAccepted: true }).allowed, false);
});

test('API booking replay cannot create a duplicate Booking', () => {
  const result = evaluateOrganisationIntegration({ ...validIntegration, replayCreatedDuplicateBooking: true });
  assert.equal(result.allowed, false);
  assert.equal(result.replayDeduplicated, false);
});

test('routine finance export cannot include sensitive passenger location', () => {
  assert.equal(organisationCommercialExportMayRun({
    tenantRolePurposeScoped: true, requestedDataNecessary: false,
    includesRawSafetyOrSafeguarding: false, includesDiagnosisCallRecordingOrUnrelatedHistory: false,
    largeOrSensitive: true, stepUpOrApprovalSatisfied: false, exportHistoryRecorded: true,
    crossTenantDataPresent: false
  }), false);
});

test('termination preserves active service, future disposition and lawful records', () => {
  assert.equal(evaluateOrganisationExitOrReinstatement({
    action: 'TERMINATE', restrictionScopeRecorded: true, activeJourneysContinueSafely: true,
    futureBookingDispositionRecorded: true, financeSafetySafeguardingAuditRetained: true,
    oldApiCredentialsBlindlyRestored: false,
    agreementCreditSecurityDocumentsContactsRevalidated: false
  }).allowed, true);
});

test('reinstatement revalidates instead of blindly restoring API credentials', () => {
  assert.equal(evaluateOrganisationExitOrReinstatement({
    action: 'REINSTATE', restrictionScopeRecorded: true, activeJourneysContinueSafely: true,
    futureBookingDispositionRecorded: true, financeSafetySafeguardingAuditRetained: true,
    oldApiCredentialsBlindlyRestored: false,
    agreementCreditSecurityDocumentsContactsRevalidated: true
  }).allowed, true);
});

test('legacy approved driver flag cannot bypass current eligibility', () => {
  const result = evaluateOrganisationMigration({
    dryRunCompleted: true, mappingAndDuplicateChecksCompleted: true,
    rowLevelOutcomesVisible: true, sensitiveDataMinimised: true,
    sourceOfTruthCutoverRecorded: true, legacyApprovedDriverFlagTrusted: true,
    legacySafePassengerFlagTrusted: false, currentEligibilitySafetySecurityRevalidated: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.legacyBypassAccepted, false);
});

test('finance-only role is denied safeguarding data server-side', () => {
  const result = evaluateOrganisationPortalAccess({
    authenticatedMembershipCurrent: true, tenantScopeMatches: true,
    backendRolePermissionSatisfied: true, uiElementVisible: true,
    financeRoleRequestedSafeguardingData: true, internalDazatPrivilegeRequested: false,
    searchScopedBeforeExecution: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.uiVisibilityIsAuthority, false);
});

test('portal cannot relabel passenger-not-ready as no-show for revenue treatment', () => {
  const result = evaluateContractualRemedy({
    canonicalClassification: 'PASSENGER_NOT_READY', requestedClassification: 'NO_SHOW',
    accessibilityDelayMisclassifiedAsNoShow: false, safeguardingFailureMisclassifiedAsNoShow: false,
    financeRuleUsesCanonicalClassification: true, originalFareAndLedgerHistoryPreserved: true,
    serviceCreditDistinctFromRefundPromotionAndDriverAdjustment: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.classificationRewritten, false);
});

test('Part 3 catalogues exactly match the blueprint counts', () => {
  assert.equal(ORGANISATION_AGREEMENT_STATES.length, 13);
  assert.equal(INSTITUTIONAL_APPROVAL_DECISIONS.length, 4);
  assert.equal(ORGANISATION_CREDIT_STATES.length, 5);
  assert.equal(ORGANISATION_COMMERCIAL_RESTRICTION_SCOPES.length, 6);
  assert.equal(INSTITUTIONAL_EVENT_CLASSIFICATIONS.length, 7);
  assert.equal(ORGANISATION_COMMERCIAL_API_PATHS.length, 12);
  assert.equal(ORGANISATION_COMMERCIAL_COMMANDS.length, 10);
  assert.equal(ORGANISATION_COMMERCIAL_EVENTS.length, 16);
  assert.equal(ORGANISATION_COMMERCIAL_P0_REQUIREMENTS.length, 20);
  assert.equal(ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS.length, 19);
});

test('every Part 3 acceptance scenario preserves canonical protected truth', () => {
  for (const scenario of ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS) {
    assert.equal(organisationCommercialAcceptanceScenarioMayPass({
      scenario, historicalVersionsPreserved: true, hardProtectionPrecedencePreserved: true,
      canonicalBookingDispatchJourneyFinanceUsed: true,
      passengerPersonalLiabilityNotCreated: true, tenantRolePurposeScopePreserved: true,
      activePassengerContinuityPreserved: true, idempotencyAndAuditEvidencePresent: true,
      legacyOrCommercialBypassUsed: false
    }), true);
  }
});

test('Part 3 hard boundaries remain disabled', () => {
  assert.equal(COMMERCIAL_CONTRACT_OVERRIDES_HARD_PROTECTION, false);
  assert.equal(AGREEMENT_DOCUMENT_IS_OPERATIONAL_POLICY, false);
  assert.equal(APPROVAL_CREATES_DRIVER_ASSIGNMENT, false);
  assert.equal(COST_CENTRE_OR_REFERENCE_EDITS_LEDGER, false);
  assert.equal(ORGANISATION_DEBT_CHARGES_PASSENGER_METHOD, false);
  assert.equal(SLA_MAY_REWRITE_CANONICAL_CLASSIFICATION, false);
  assert.equal(ORGANISATION_ALLEGATION_CREATES_AUTOMATIC_GUILT, false);
  assert.equal(MIGRATION_LEGACY_FLAGS_BYPASS_CURRENT_ELIGIBILITY, false);
  assert.equal(ORGANISATION_COMMERCIAL_MUTATIONS_ENABLED, false);
});
