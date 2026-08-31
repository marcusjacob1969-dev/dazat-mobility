import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_EXIT_MAY_ABANDON_ACTIVE_PASSENGER,
  evaluateAuthorityFundingExecution,
  evaluateEmployerFundedVisibility,
  evaluateGuestPassengerProfile,
  evaluateHospitalPassengerReadiness,
  evaluateInstitutionalBookingExecutionContext,
  evaluateInstitutionalBreakdown,
  evaluateInstitutionalComplianceEvidence,
  evaluateInstitutionalDataQuality,
  evaluateInstitutionalDegradedMode,
  evaluateInstitutionalLiveChange,
  evaluateInstitutionalOutcome,
  evaluateInstitutionalPrivacyAndAi,
  evaluateInstitutionalSecurityContainment,
  evaluateInstitutionalShiftHandover,
  evaluateInstitutionalSafetyLink,
  evaluateInstitutionalWorkspaceAccess,
  evaluateInstitutionExitPlan,
  evaluateInstitutionLaunchReadiness,
  evaluateInstitutionOccurrenceReadiness,
  evaluateInstitutionTransportException,
  evaluateManualInstitutionalDispatch,
  evaluateOrganisationServiceHealth,
  evaluateOrganisationSiteDisruption,
  evaluatePartnerOverflow,
  evaluateSchoolHandoverExecution,
  INSTITUTION_EXCEPTION_STATES,
  INSTITUTION_READINESS_OUTCOMES,
  INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES,
  INSTITUTIONAL_AI_INVENTS_AUTHORITY,
  INSTITUTIONAL_ATTENTION_PRIORITIES,
  INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS,
  INSTITUTIONAL_LIVE_API_PATHS,
  INSTITUTIONAL_LIVE_COMMANDS,
  INSTITUTIONAL_LIVE_EVENTS,
  INSTITUTIONAL_LIVE_MUTATIONS_ENABLED,
  INSTITUTIONAL_LIVE_OUTCOMES,
  INSTITUTIONAL_LIVE_P0_REQUIREMENTS,
  institutionalLiveAcceptanceScenarioMayPass,
  INSTITUTIONAL_SHADOW_TRIP_SYSTEM_ALLOWED,
  MANUAL_DISPATCH_BYPASSES_HARD_ELIGIBILITY,
  ORGANISATION_MAY_CLOSE_SAFETY_CASE,
  PASSENGER_READY_STATES,
  SERVICE_HEALTH_AUTOMATICALLY_CANCELS_BOOKING,
  SHADOW_SPREADSHEET_DISPATCH_ALLOWED,
  SIGNED_CONTRACT_ALONE_ENABLES_LAUNCH
} from '../../packages/domain/src/institutional-live-operations.ts';

test('institutional workspace requires assigned role and current task', () => {
  const result = evaluateInstitutionalWorkspaceAccess({
    operatorAssignedRole: true, currentTaskAssigned: true,
    schoolSafeguardingPermission: false, requestedSchoolSafeguardingData: false,
    financePermission: false, requestedDetailedFinanceData: false,
    manualActionUsesCanonicalBackendCommand: true, directDatabaseEditRequested: false
  });
  assert.equal(result.allowed, true);
  assert.equal(result.directDatabaseEditingAllowed, false);
});

test('general operations cannot inherit school safeguarding or finance detail', () => {
  assert.equal(evaluateInstitutionalWorkspaceAccess({
    operatorAssignedRole: true, currentTaskAssigned: true,
    schoolSafeguardingPermission: false, requestedSchoolSafeguardingData: true,
    financePermission: false, requestedDetailedFinanceData: false,
    manualActionUsesCanonicalBackendCommand: true, directDatabaseEditRequested: false
  }).allowed, false);
});

const baseException = {
  category: 'CAPACITY', priority: 'P1', authoritativeBookingOrSeriesLinked: true,
  occurrenceOrganisationSourceAndDetectedTimeRecorded: true, structuredClassificationPresent: true,
  ownerPresent: true, nextActionPresent: true, attentionDeadlinePresent: true,
  specialisedCaseLinkedWhereRequired: true, specialisedCaseReplacedByException: false,
  linkedCaseAutoClosed: false, resolutionActionTaken: false, intendedOutcomeVerified: false
};

test('critical institutional exception requires ownership and remains separate from specialist cases', () => {
  const result = evaluateInstitutionTransportException(baseException);
  assert.equal(result.allowed, true);
  assert.equal(result.state, 'OPEN');
  assert.equal(result.linkedCasesRemainIndependent, true);
});

test('unowned P0-P3 institutional exception fails closed', () => {
  assert.equal(evaluateInstitutionTransportException({ ...baseException, ownerPresent: false }).allowed, false);
});

test('resolved exception differs from verified operational outcome', () => {
  assert.equal(evaluateInstitutionTransportException({ ...baseException, resolutionActionTaken: true }).state, 'RESOLVED');
  assert.equal(evaluateInstitutionTransportException({ ...baseException, resolutionActionTaken: true, intendedOutcomeVerified: true }).state, 'VERIFIED');
  assert.equal(evaluateInstitutionTransportException({ ...baseException, intendedOutcomeVerified: true }).allowed, false);
});

const readyAssessment = {
  agreementCurrent: true, fundingCurrent: true, passengerAndServiceEligibilityCurrent: true,
  contactPlanCurrent: true, specialistCapacityCurrent: true, calendarAndSiteExceptionsApplied: true,
  recalculatedAfterMaterialChange: true, driverGuaranteed: false
};

test('pre-service readiness checks every independent operational dimension', () => {
  const result = evaluateInstitutionOccurrenceReadiness(readyAssessment);
  assert.equal(result.outcome, 'READY');
  assert.equal(result.driverGuaranteed, false);
  assert.equal(result.dimensionsRemainDistinct, true);
});

test('readiness never guarantees a driver and blocks stale assessment', () => {
  assert.equal(evaluateInstitutionOccurrenceReadiness({ ...readyAssessment, driverGuaranteed: true }).outcome, 'BLOCKED');
  assert.equal(evaluateInstitutionOccurrenceReadiness({ ...readyAssessment, recalculatedAfterMaterialChange: false }).outcome, 'BLOCKED');
});

const validDispatch = {
  normalDriverEligibility: true, vehicleEligibility: true, institutionalServicePermission: true,
  accessibilityRequirementsSatisfied: true, safeguardingRequirementsSatisfied: true,
  scheduledCommitmentConflictFree: true, partnerOverflow: false,
  partnerEquivalentControlsSatisfied: false, endlessSearchHidesNoEligibleDriver: false
};

test('manual institutional dispatch uses every canonical hard filter', () => {
  assert.equal(evaluateManualInstitutionalDispatch(validDispatch).action, 'ASSIGN_CANONICALLY');
});

test('manual non-school-qualified assignment opens explicit exception', () => {
  const result = evaluateManualInstitutionalDispatch({ ...validDispatch, safeguardingRequirementsSatisfied: false });
  assert.equal(result.action, 'OPEN_NO_ELIGIBLE_DRIVER_EXCEPTION');
  assert.equal(result.forcedAssignment, false);
});

test('partner capacity does not bypass equivalent specialist controls', () => {
  assert.equal(evaluateManualInstitutionalDispatch({ ...validDispatch, partnerOverflow: true }).action, 'OPEN_NO_ELIGIBLE_DRIVER_EXCEPTION');
});

test('institutional Booking retains immutable agreement and funding execution context', () => {
  assert.equal(evaluateInstitutionalBookingExecutionContext({
    organisationIdRecorded: true, agreementVersionRecorded: true,
    servicePolicyVersionRecorded: true, billingAccountRecorded: true,
    fundingAndApprovalReferencesRecorded: true, mutablePortalSettingsCopiedAsAuthority: false,
    historicalContextRewritten: false, liveAmendmentPreservesOriginalDecisionHistory: true
  }), true);
});

test('failed school handover blocks ordinary completion and enters P1 safeguarding', () => {
  const result = evaluateSchoolHandoverExecution({
    arrivalCommunicationPlanUsed: true, approvedRideCheckOrGuardianVerificationUsed: true,
    authorisedHandoverOrIndependentTravelRule: false, handoverFailed: true,
    ordinaryCompletionAttempted: false, p1SafeguardingWorkflowOpened: true,
    manifestOperationalMinimumOnly: true, routeChangeVersionedAndCommunicated: true
  });
  assert.equal(result.completionAllowed, false);
  assert.equal(result.priority, 'P1');
});

test('ordinary school completion requires authorised handover and minimised manifest', () => {
  assert.equal(evaluateSchoolHandoverExecution({
    arrivalCommunicationPlanUsed: true, approvedRideCheckOrGuardianVerificationUsed: true,
    authorisedHandoverOrIndependentTravelRule: true, handoverFailed: false,
    ordinaryCompletionAttempted: true, p1SafeguardingWorkflowOpened: false,
    manifestOperationalMinimumOnly: true, routeChangeVersionedAndCommunicated: true
  }).completionAllowed, true);
});

test('authority funding expiry affects future service but never onboard continuity', () => {
  const result = evaluateAuthorityFundingExecution({
    competentAuthorityDecisionRecorded: true, dazatInventedStatutoryEligibility: false,
    fundingCurrentForFutureService: false, passengerCurrentlyOnboard: true,
    activeSafetyAndContinuityPreserved: true, requestedChangeWithinAuthorityLimits: true,
    passengerPersonalLiabilityFallback: false
  });
  assert.equal(result.activeServiceContinues, true);
  assert.equal(result.futureAction, 'OPEN_FUNDING_EXCEPTION');
  assert.equal(result.personalLiabilityCreated, false);
});

test('authority funding never falls back to passenger personal liability', () => {
  const result = evaluateAuthorityFundingExecution({
    competentAuthorityDecisionRecorded: true, dazatInventedStatutoryEligibility: false,
    fundingCurrentForFutureService: true, passengerCurrentlyOnboard: false,
    activeSafetyAndContinuityPreserved: true, requestedChangeWithinAuthorityLimits: true,
    passengerPersonalLiabilityFallback: true
  });
  assert.equal(result.futureAction, 'OPEN_FUNDING_EXCEPTION');
  assert.equal(result.personalLiabilityCreated, false);
});

test('hospital passenger-not-ready remains distinct from no-show and Driver cancellation', () => {
  const result = evaluateHospitalPassengerReadiness({
    state: 'NOT_READY', authorisedReadinessContact: true,
    readinessContactRequestedPaymentChange: false, operationalAssistanceDataOnly: true,
    passengerNotReadyRelabelledNoShow: false, driverReleasedAfterLongDelay: true,
    driverCancellationFalselyRecorded: false, emergencyMedicalCapabilityClaimed: false
  });
  assert.equal(result.allowed, true);
  assert.equal(result.noShowRecorded, false);
});

test('readiness contact cannot change unrelated payment details', () => {
  assert.equal(evaluateHospitalPassengerReadiness({
    state: 'READY', authorisedReadinessContact: true,
    readinessContactRequestedPaymentChange: true, operationalAssistanceDataOnly: true,
    passengerNotReadyRelabelledNoShow: false, driverReleasedAfterLongDelay: false,
    driverCancellationFalselyRecorded: false, emergencyMedicalCapabilityClaimed: false
  }).allowed, false);
});

test('employer sees funded work transport but not unrelated personal Journey history', () => {
  assert.equal(evaluateEmployerFundedVisibility({
    businessPurposeAndFundingScopeCurrent: true, fundedJourneyVisible: true,
    unrelatedPersonalJourneyVisible: false, safetyOrPersonalDataVisibleToApprover: false,
    employmentEnded: false, futureOrganisationAuthorityRemoved: false,
    personalAccountDeleted: false
  }), true);
});

test('guest booking remains minimal, scoped and smartphone-independent', () => {
  assert.equal(evaluateGuestPassengerProfile({
    bookingOrOrganisationScopePresent: true, minimumDataOnly: true,
    bookerPassengerPayerSeparated: true, smartphoneRequired: false,
    indefiniteShadowProfileCreated: false, personalAccountLinkRequested: false,
    controlledClaimLinkCompleted: false
  }), true);
});

test('third-party onboard redirect needs proper authority and canonical amendment', () => {
  assert.equal(evaluateInstitutionalLiveChange({
    requesterAuthorityCurrent: true, passengerOnboard: true,
    thirdPartyRedirectPermitted: false, canonicalJourneyAmendmentUsed: true,
    schoolGuardianChangeAuthorisedOrNotApplicable: true, eligibilityRevalidatedAfterMaterialChange: true,
    freeTextTreatedAsAuthoritativeState: false
  }), false);
});

test('contract charge and SLA cannot relabel canonical outcome', () => {
  const result = evaluateInstitutionalOutcome({
    canonicalOutcome: 'PASSENGER_NOT_READY', requestedOutcome: 'RIDER_NO_SHOW',
    accessibilityBoardingTimeRelabelledNoShow: false,
    financeUsesCanonicalOutcome: true, slaUsesCanonicalOutcome: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.relabelled, false);
});

test('WAV breakdown creates continuity and rescue while retaining one Booking and Journey', () => {
  assert.equal(evaluateInstitutionalBreakdown({
    passengerContinuityCaseCreated: true, vehicleRescueCaseCreated: true,
    replacementCreatedNewCustomerBooking: false, originalBookingAndJourneyPreserved: true,
    passengerAccessibilitySchoolContractRequirementsRevalidated: true,
    ordinaryApprovalWouldStrandPassenger: true, continuityBlockedByOrdinaryApproval: false
  }), true);
});

test('organisation cannot suppress, downgrade or close DAZAT Safety case', () => {
  assert.equal(evaluateInstitutionalSafetyLink({
    specialisedSafetyCaseAuthoritative: true,
    organisationAttemptedSuppressDowngradeOrClose: true,
    disclosurePurposeAndAuthorityRecorded: true,
    temporaryRestrictionExposedAsCustomerAdminButton: false,
    allegationLabelledAndAssessed: true
  }), false);
});

test('compliance evidence prefers scoped attestation over raw restricted documents', () => {
  assert.equal(evaluateInstitutionalComplianceEvidence({
    authoritativeSourceVersionsRecorded: true, generatedAtAndScopeRecorded: true,
    narrowAttestationSufficient: true, rawRestrictedDocumentsIncluded: false,
    expiredOrSupersededEvidenceLabelled: true, releaseAudited: true,
    assignmentTimeEligibilityEvaluated: true
  }), true);
  assert.equal(evaluateInstitutionalComplianceEvidence({
    authoritativeSourceVersionsRecorded: true, generatedAtAndScopeRecorded: true,
    narrowAttestationSufficient: false, rawRestrictedDocumentsIncluded: true,
    expiredOrSupersededEvidenceLabelled: true, releaseAudited: true,
    assignmentTimeEligibilityEvaluated: true
  }), false);
});

test('critical invalid guardian contact blocks silently guessed dispatch', () => {
  assert.equal(evaluateInstitutionalDataQuality({
    issueType: 'MISSING_CONTACT', critical: true, issueRecorded: true,
    occurrenceGenerationOrDispatchBlockedWhenRequired: true,
    operatorInventedMissingData: false, correctionVersionedAndAudited: true
  }), true);
});

test('one school closure affects occurrences without destroying recurring series', () => {
  assert.equal(evaluateOrganisationSiteDisruption({
    structuredSiteProfileCurrent: true, disruptionScopeAndTimeRecorded: true,
    affectedFutureBookingsEvaluated: true, geofenceTreatedAsAbsoluteProof: false,
    authorisedChangesCommunicated: true, schoolSeriesDestroyedForOneClosure: false
  }), true);
});

test('partner overflow retains DAZAT canonical truth and minimum assigned data', () => {
  assert.equal(evaluatePartnerOverflow({
    partnerAgreementCurrent: true, driverAndVehicleEligible: true,
    equivalentAccessibilitySafeguardingAndServiceControls: true,
    canonicalDazatBookingAndJourneyRetained: true, sufficientStatusEventsReturned: true,
    partnerFailureBlamedOnPassenger: false, wholeOrganisationRosterShared: false
  }), true);
});

test('portal outage uses canonical contingency and no shadow spreadsheet dispatch', () => {
  assert.equal(evaluateInstitutionalDegradedMode({
    activeJourneysAndSafetyPrioritised: true, canonicalContingencyInterfaceUsed: true,
    shadowSpreadsheetOrPersonalMessagingUsed: false,
    contingencyRecordsUniquelyIdentified: true, recoveryDeduplicatesAndReconciles: true,
    blindPaymentRetryPerformed: false, shieldRiskyChangesPaused: true
  }), true);
});

test('compromised organisation admin is contained without terminating valid active trips', () => {
  assert.equal(evaluateInstitutionalSecurityContainment({
    riskDecision: 'HOLD', riskyCapabilityScoped: true,
    compromisedSessionOrCredentialRevoked: true, validActiveJourneysContinueSafely: true,
    highRiskChangeHeld: true, trustedContactSafeNotificationPlanned: true
  }), true);
});

test('live tracking expires and AI cannot invent institutional authority', () => {
  assert.equal(evaluateInstitutionalPrivacyAndAi({
    trackingPurposeCurrentAndAuthorised: true, trackingAccessConfiguredToExpireAfterNeed: true,
    generalEmployeeTrackingAttempted: false, unrelatedHistoryDisclosed: false,
    aiAction: 'SUMMARISE'
  }), true);
  assert.equal(evaluateInstitutionalPrivacyAndAi({
    trackingPurposeCurrentAndAuthorised: true, trackingAccessConfiguredToExpireAfterNeed: true,
    generalEmployeeTrackingAttempted: false, unrelatedHistoryDisclosed: false,
    aiAction: 'INVENT_AUTHORITY'
  }), false);
});

test('poor service-health status never itself cancels a Booking', () => {
  assert.equal(evaluateOrganisationServiceHealth({
    dimensionsVersionedAndEvidenceBacked: true,
    safetySeverityBlendedIntoCustomerScore: false, punitiveMysteryScoreCreated: false,
    poorStatusAutomaticallyCancelledBooking: false,
    consequencesAppliedOnlyThroughCanonicalDomainPolicy: true
  }), true);
});

test('shift handover transfers structured P0/P1 ownership', () => {
  assert.equal(evaluateInstitutionalShiftHandover({
    criticalItemsStructured: true, incomingOperatorAcceptedP0P1Ownership: true,
    criticalWorkOnlyInFreeText: false, promisedCapabilityExistsAndAcceptanceTested: true,
    unsupportedGuaranteePromised: false
  }), true);
});

test('signed contract with incomplete contact and billing gates cannot launch', () => {
  const result = evaluateInstitutionLaunchReadiness({
    signedAgreementPresent: true, agreementPolicyReady: true,
    billingFundingReady: false, usersContactsRosterSchedulesReady: false,
    specialistAndSafeguardingControlsReady: true,
    communicationsPortalSupportContingencyReady: true,
    failedGatesHaveActionPlansOrNoneFailed: true, salesPressureChangedReadyStatus: false,
    pilotRequired: false, pilotGatePassed: false, authorisedRiskAcceptanceRecorded: false
  });
  assert.equal(result.ready, false);
  assert.equal(result.signedContractAloneSufficient, false);
});

test('failed pilot gate blocks expansion without authorised risk acceptance', () => {
  assert.equal(evaluateInstitutionLaunchReadiness({
    signedAgreementPresent: true, agreementPolicyReady: true,
    billingFundingReady: true, usersContactsRosterSchedulesReady: true,
    specialistAndSafeguardingControlsReady: true,
    communicationsPortalSupportContingencyReady: true,
    failedGatesHaveActionPlansOrNoneFailed: true, salesPressureChangedReadyStatus: false,
    pilotRequired: true, pilotGatePassed: false, authorisedRiskAcceptanceRecorded: false
  }).ready, false);
});

test('contract exit preserves active passenger, open cases and lawful records', () => {
  const result = evaluateInstitutionExitPlan({
    inventoryComplete: true, newBookingStopTimeRecorded: true,
    futureBookingDispositionRecorded: true, accessRevocationTimed: true,
    lawfulRecordsAndOpenCasesPreserved: true, governedExportProcessUsed: true,
    activePassengerAbandoned: false
  });
  assert.equal(result.allowed, true);
  assert.equal(result.activePassengerAbandoned, false);
});

test('Part 4 catalogues and collision-resolved P0 IDs match the blueprint', () => {
  assert.equal(INSTITUTIONAL_ATTENTION_PRIORITIES.length, 5);
  assert.equal(INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES.length, 11);
  assert.equal(INSTITUTION_EXCEPTION_STATES.length, 14);
  assert.equal(INSTITUTION_READINESS_OUTCOMES.length, 4);
  assert.equal(PASSENGER_READY_STATES.length, 6);
  assert.equal(INSTITUTIONAL_LIVE_OUTCOMES.length, 10);
  assert.equal(INSTITUTIONAL_LIVE_API_PATHS.length, 11);
  assert.equal(INSTITUTIONAL_LIVE_COMMANDS.length, 12);
  assert.equal(INSTITUTIONAL_LIVE_EVENTS.length, 17);
  assert.equal(INSTITUTIONAL_LIVE_P0_REQUIREMENTS.length, 21);
  assert.equal(INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS.length, 30);
  for (const id of ['ORG-AUT-002', 'ORG-HLT-002', 'ORG-PAR-001', 'ORG-SCH-005', 'ORG-SCH-006']) {
    assert.ok(INSTITUTIONAL_LIVE_P0_REQUIREMENTS.includes(id));
  }
});

test('every Part 4 acceptance scenario preserves canonical tenant-safe live operations', () => {
  for (const scenario of INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS) {
    assert.equal(institutionalLiveAcceptanceScenarioMayPass({
      scenario, canonicalBookingJourneyDispatchPreserved: true,
      hardEligibilityAndSafetyPreserved: true, tenantRolePurposeScopePreserved: true,
      outcomeClassificationPreserved: true, activePassengerContinuityPreserved: true,
      auditAndIdempotencyPreserved: true, shadowSystemUsed: false
    }), true);
  }
});

test('final Organisation Engine hard boundaries remain disabled', () => {
  assert.equal(INSTITUTIONAL_SHADOW_TRIP_SYSTEM_ALLOWED, false);
  assert.equal(MANUAL_DISPATCH_BYPASSES_HARD_ELIGIBILITY, false);
  assert.equal(ORGANISATION_MAY_CLOSE_SAFETY_CASE, false);
  assert.equal(SERVICE_HEALTH_AUTOMATICALLY_CANCELS_BOOKING, false);
  assert.equal(SHADOW_SPREADSHEET_DISPATCH_ALLOWED, false);
  assert.equal(INSTITUTIONAL_AI_INVENTS_AUTHORITY, false);
  assert.equal(SIGNED_CONTRACT_ALONE_ENABLES_LAUNCH, false);
  assert.equal(CONTRACT_EXIT_MAY_ABANDON_ACTIVE_PASSENGER, false);
  assert.equal(INSTITUTIONAL_LIVE_MUTATIONS_ENABLED, false);
});
