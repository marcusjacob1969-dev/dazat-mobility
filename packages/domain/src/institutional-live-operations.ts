export const INSTITUTIONAL_ATTENTION_PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type InstitutionalAttentionPriority = (typeof INSTITUTIONAL_ATTENTION_PRIORITIES)[number];

export const INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES = [
  'CAPACITY', 'DRIVER_ELIGIBILITY', 'VEHICLE_ELIGIBILITY',
  'PASSENGER_REQUIREMENT_MISMATCH', 'APPROVAL_OR_FUNDING', 'CONTACT_FAILURE',
  'PASSENGER_NOT_READY', 'SITE_ACCESS', 'SCHEDULE_CONFLICT',
  'CONTRACT_POLICY', 'SYSTEM_OR_PROVIDER_FAILURE'
] as const;

export const INSTITUTION_EXCEPTION_STATES = [
  'DETECTED', 'TRIAGED', 'OWNED', 'ACTION_IN_PROGRESS', 'WAITING_EXTERNAL',
  'WAITING_CUSTOMER', 'WAITING_SYSTEM', 'RESOLVED', 'VERIFIED', 'CLOSED',
  'ESCALATED', 'MERGED', 'REOPENED', 'SUPERSEDED'
] as const;

export const INSTITUTION_READINESS_OUTCOMES = ['READY', 'WATCH', 'AT_RISK', 'BLOCKED'] as const;
export type InstitutionReadinessOutcome = (typeof INSTITUTION_READINESS_OUTCOMES)[number];

export const PASSENGER_READY_STATES = [
  'UNKNOWN', 'EXPECTED_READY', 'READY', 'DELAYED', 'NOT_READY', 'CANCELLED_BY_PROVIDER'
] as const;
export type PassengerReadyState = (typeof PASSENGER_READY_STATES)[number];

export const INSTITUTIONAL_LIVE_OUTCOMES = [
  'PASSENGER_CANCELLED', 'ORGANISATION_CANCELLED', 'DRIVER_CANCELLED',
  'OPERATIONS_CANCELLED', 'PASSENGER_NOT_READY', 'RIDER_NO_SHOW',
  'SCHOOL_ABSENCE', 'HANDOVER_FAILED', 'TECHNICAL_FAILURE', 'NO_ELIGIBLE_DRIVER'
] as const;
export type InstitutionalLiveOutcome = (typeof INSTITUTIONAL_LIVE_OUTCOMES)[number];

export const INSTITUTIONAL_LIVE_API_PATHS = [
  '/organisation-operations/exceptions', '/organisation-operations/readiness',
  '/organisations/{id}/sites', '/organisations/{id}/operational-contacts',
  '/organisations/{id}/service-health', '/organisations/{id}/launch-readiness',
  '/organisations/{id}/pilots', '/organisations/{id}/exit-plan',
  '/funding-authorisations', '/passenger-readiness', '/disruptions'
] as const;

export const INSTITUTIONAL_LIVE_COMMANDS = [
  'AssessInstitutionOccurrenceReadiness', 'OpenInstitutionTransportException',
  'AssignInstitutionExceptionOwner', 'ResolveInstitutionTransportException',
  'VerifyInstitutionExceptionResolution', 'SetPassengerReadyState',
  'CreateFundingAuthorisation', 'ChangeFundingAuthorisation',
  'DeclareInstitutionDisruption', 'RunInstitutionLaunchReadiness',
  'StartInstitutionPilot', 'CreateInstitutionExitPlan'
] as const;

export const INSTITUTIONAL_LIVE_EVENTS = [
  'InstitutionOccurrenceReady.v1', 'InstitutionOccurrenceAtRisk.v1',
  'InstitutionOccurrenceBlocked.v1', 'InstitutionTransportExceptionOpened.v1',
  'InstitutionTransportExceptionEscalated.v1', 'InstitutionTransportExceptionResolved.v1',
  'PassengerReadyStateChanged.v1', 'FundingAuthorisationChanged.v1',
  'InstitutionCriticalContactUnreachable.v1', 'OrganisationSiteDisrupted.v1',
  'InstitutionDisruptionDeclared.v1', 'InstitutionLaunchReadinessPassed.v1',
  'InstitutionLaunchReadinessFailed.v1', 'InstitutionPilotGatePassed.v1',
  'InstitutionPilotGateFailed.v1', 'InstitutionExitStarted.v1',
  'InstitutionExitCompleted.v1'
] as const;

export const INSTITUTIONAL_LIVE_P0_REQUIREMENTS = [
  'ORG-OPS-001', 'ORG-OPS-002', 'ORG-OPS-003', 'ORG-OPS-004', 'ORG-EXC-001',
  'ORG-SCH-005', 'ORG-SCH-006', 'ORG-AUT-002', 'ORG-HLT-002', 'ORG-CORP-001',
  'ORG-COM-001', 'ORG-BRK-001', 'ORG-SAF-001', 'ORG-EVD-001', 'ORG-DQ-001',
  'ORG-PAR-001', 'ORG-RES-001', 'ORG-SEC-002', 'ORG-PRV-001', 'ORG-LCH-001',
  'ORG-EXT-001'
] as const;

export const INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS = [
  'CORPORATE_VISIBILITY_MINIMISED', 'SNOW_DAY_OCCURRENCES_ONLY',
  'SCHOOL_QUALIFICATION_EXPIRY_REASSIGNED', 'MANUAL_INELIGIBLE_SCHOOL_DRIVER_REJECTED',
  'FAILED_HANDOVER_BLOCKS_COMPLETION', 'HOSPITAL_DELAY_NOT_NO_SHOW',
  'READINESS_CONTACT_CANNOT_EDIT_PAYMENT', 'AUTHORITY_EXPIRY_PRESERVES_ACTIVE',
  'THIRD_PARTY_DESTINATION_CHANGE_REAUTHORISED', 'WAV_BREAKDOWN_ONE_CANONICAL_JOURNEY',
  'INELIGIBLE_PARTNER_OVERFLOW_REJECTED', 'CREDIT_LIMIT_NEVER_CHARGES_PASSENGER',
  'ADMIN_TAKEOVER_CONTAINED_ACTIVE_TRIPS_CONTINUE', 'FINANCE_USER_RAW_MANIFEST_DENIED',
  'DUPLICATE_API_BOOKING_DEDUPLICATED', 'PORTAL_OUTAGE_NO_SHADOW_DISPATCH',
  'HANDOVER_SMS_OUTAGE_SAFE_FALLBACK', 'SITE_DISRUPTION_PROPAGATES_AUTHORISED_CHANGE',
  'INVALID_GUARDIAN_CONTACT_PRE_DISPATCH', 'ALLEGATION_PRESERVES_PLATFORM_CAUSE',
  'WAV_SHORTAGE_REPORTED_TRUTHFULLY', 'COMPLETED_JOURNEY_SLA_REWRITE_REJECTED',
  'COMPLIANCE_ATTESTATION_MINIMISED', 'SIGNED_INCOMPLETE_CONTRACT_NOT_READY',
  'FAILED_PILOT_GATE_BLOCKS_EXPANSION', 'EXIT_PRESERVES_ACTIVE_AND_OPEN_CASES',
  'RELATIONSHIP_REMOVAL_NO_CROSS_TENANT_EFFECT', 'MAJOR_POLICY_SIMULATION_PREVIEWS_IMPACT',
  'LIVE_TRACKING_EXPIRES_AFTER_NEED', 'PARTNER_OUTAGE_RECONCILES_ONE_TIMELINE'
] as const;
export type InstitutionalLiveAcceptanceScenario = (typeof INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS)[number];

export function evaluateInstitutionalWorkspaceAccess(input: {
  readonly operatorAssignedRole: boolean;
  readonly currentTaskAssigned: boolean;
  readonly schoolSafeguardingPermission: boolean;
  readonly requestedSchoolSafeguardingData: boolean;
  readonly financePermission: boolean;
  readonly requestedDetailedFinanceData: boolean;
  readonly manualActionUsesCanonicalBackendCommand: boolean;
  readonly directDatabaseEditRequested: boolean;
}): { readonly allowed: boolean; readonly directDatabaseEditingAllowed: false } {
  return {
    allowed: input.operatorAssignedRole && input.currentTaskAssigned
      && (!input.requestedSchoolSafeguardingData || input.schoolSafeguardingPermission)
      && (!input.requestedDetailedFinanceData || input.financePermission)
      && input.manualActionUsesCanonicalBackendCommand && !input.directDatabaseEditRequested,
    directDatabaseEditingAllowed: false
  };
}

export function evaluateInstitutionTransportException(input: {
  readonly category: (typeof INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES)[number];
  readonly priority: InstitutionalAttentionPriority;
  readonly authoritativeBookingOrSeriesLinked: boolean;
  readonly occurrenceOrganisationSourceAndDetectedTimeRecorded: boolean;
  readonly structuredClassificationPresent: boolean;
  readonly ownerPresent: boolean;
  readonly nextActionPresent: boolean;
  readonly attentionDeadlinePresent: boolean;
  readonly specialisedCaseLinkedWhereRequired: boolean;
  readonly specialisedCaseReplacedByException: boolean;
  readonly linkedCaseAutoClosed: boolean;
  readonly resolutionActionTaken: boolean;
  readonly intendedOutcomeVerified: boolean;
}): { readonly allowed: boolean; readonly state: 'OPEN' | 'RESOLVED' | 'VERIFIED'; readonly linkedCasesRemainIndependent: true } {
  const criticalOwnership = !['P0', 'P1', 'P2', 'P3'].includes(input.priority)
    || (input.ownerPresent && input.nextActionPresent && input.attentionDeadlinePresent);
  const verificationConsistent = !input.intendedOutcomeVerified || input.resolutionActionTaken;
  const allowed = INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES.includes(input.category)
    && input.authoritativeBookingOrSeriesLinked
    && input.occurrenceOrganisationSourceAndDetectedTimeRecorded
    && input.structuredClassificationPresent && criticalOwnership
    && input.specialisedCaseLinkedWhereRequired && !input.specialisedCaseReplacedByException
    && !input.linkedCaseAutoClosed && verificationConsistent;
  return {
    allowed,
    state: input.resolutionActionTaken
      ? input.intendedOutcomeVerified ? 'VERIFIED' : 'RESOLVED'
      : 'OPEN',
    linkedCasesRemainIndependent: true
  };
}

export function evaluateInstitutionOccurrenceReadiness(input: {
  readonly agreementCurrent: boolean;
  readonly fundingCurrent: boolean;
  readonly passengerAndServiceEligibilityCurrent: boolean;
  readonly contactPlanCurrent: boolean;
  readonly specialistCapacityCurrent: boolean;
  readonly calendarAndSiteExceptionsApplied: boolean;
  readonly recalculatedAfterMaterialChange: boolean;
  readonly driverGuaranteed: boolean;
}): { readonly outcome: InstitutionReadinessOutcome; readonly driverGuaranteed: false; readonly dimensionsRemainDistinct: true } {
  const dimensions = [input.agreementCurrent, input.fundingCurrent,
    input.passengerAndServiceEligibilityCurrent, input.contactPlanCurrent,
    input.specialistCapacityCurrent, input.calendarAndSiteExceptionsApplied];
  const failures = dimensions.filter((value) => !value).length;
  const outcome: InstitutionReadinessOutcome = !input.recalculatedAfterMaterialChange || input.driverGuaranteed
    ? 'BLOCKED' : failures === 0 ? 'READY' : failures === 1 ? 'WATCH' : failures <= 3 ? 'AT_RISK' : 'BLOCKED';
  return { outcome, driverGuaranteed: false, dimensionsRemainDistinct: true };
}

export function evaluateManualInstitutionalDispatch(input: {
  readonly normalDriverEligibility: boolean;
  readonly vehicleEligibility: boolean;
  readonly institutionalServicePermission: boolean;
  readonly accessibilityRequirementsSatisfied: boolean;
  readonly safeguardingRequirementsSatisfied: boolean;
  readonly scheduledCommitmentConflictFree: boolean;
  readonly partnerOverflow: boolean;
  readonly partnerEquivalentControlsSatisfied: boolean;
  readonly endlessSearchHidesNoEligibleDriver: boolean;
}): { readonly action: 'ASSIGN_CANONICALLY' | 'OPEN_NO_ELIGIBLE_DRIVER_EXCEPTION' | 'DENY'; readonly forcedAssignment: false } {
  const hardEligible = input.normalDriverEligibility && input.vehicleEligibility
    && input.institutionalServicePermission && input.accessibilityRequirementsSatisfied
    && input.safeguardingRequirementsSatisfied && input.scheduledCommitmentConflictFree
    && (!input.partnerOverflow || input.partnerEquivalentControlsSatisfied);
  if (input.endlessSearchHidesNoEligibleDriver) return { action: 'DENY', forcedAssignment: false };
  return { action: hardEligible ? 'ASSIGN_CANONICALLY' : 'OPEN_NO_ELIGIBLE_DRIVER_EXCEPTION', forcedAssignment: false };
}

export function evaluateInstitutionalBookingExecutionContext(input: {
  readonly organisationIdRecorded: boolean;
  readonly agreementVersionRecorded: boolean;
  readonly servicePolicyVersionRecorded: boolean;
  readonly billingAccountRecorded: boolean;
  readonly fundingAndApprovalReferencesRecorded: boolean;
  readonly mutablePortalSettingsCopiedAsAuthority: boolean;
  readonly historicalContextRewritten: boolean;
  readonly liveAmendmentPreservesOriginalDecisionHistory: boolean;
}): boolean {
  return input.organisationIdRecorded && input.agreementVersionRecorded
    && input.servicePolicyVersionRecorded && input.billingAccountRecorded
    && input.fundingAndApprovalReferencesRecorded && !input.mutablePortalSettingsCopiedAsAuthority
    && !input.historicalContextRewritten && input.liveAmendmentPreservesOriginalDecisionHistory;
}

export function evaluateSchoolHandoverExecution(input: {
  readonly arrivalCommunicationPlanUsed: boolean;
  readonly approvedRideCheckOrGuardianVerificationUsed: boolean;
  readonly authorisedHandoverOrIndependentTravelRule: boolean;
  readonly handoverFailed: boolean;
  readonly ordinaryCompletionAttempted: boolean;
  readonly p1SafeguardingWorkflowOpened: boolean;
  readonly manifestOperationalMinimumOnly: boolean;
  readonly routeChangeVersionedAndCommunicated: boolean;
}): { readonly completionAllowed: boolean; readonly priority: 'P1' | 'ROUTINE' } {
  const common = input.arrivalCommunicationPlanUsed
    && input.approvedRideCheckOrGuardianVerificationUsed
    && input.manifestOperationalMinimumOnly && input.routeChangeVersionedAndCommunicated;
  if (input.handoverFailed) {
    return { completionAllowed: false, priority: input.p1SafeguardingWorkflowOpened && !input.ordinaryCompletionAttempted ? 'P1' : 'ROUTINE' };
  }
  return { completionAllowed: common && input.authorisedHandoverOrIndependentTravelRule, priority: 'ROUTINE' };
}

export function evaluateAuthorityFundingExecution(input: {
  readonly competentAuthorityDecisionRecorded: boolean;
  readonly dazatInventedStatutoryEligibility: boolean;
  readonly fundingCurrentForFutureService: boolean;
  readonly passengerCurrentlyOnboard: boolean;
  readonly activeSafetyAndContinuityPreserved: boolean;
  readonly requestedChangeWithinAuthorityLimits: boolean;
  readonly passengerPersonalLiabilityFallback: boolean;
}): { readonly activeServiceContinues: boolean; readonly futureAction: 'ALLOW' | 'OPEN_FUNDING_EXCEPTION'; readonly personalLiabilityCreated: false } {
  const activeServiceContinues = !input.passengerCurrentlyOnboard || input.activeSafetyAndContinuityPreserved;
  const authorised = input.competentAuthorityDecisionRecorded && !input.dazatInventedStatutoryEligibility
    && input.fundingCurrentForFutureService && input.requestedChangeWithinAuthorityLimits
    && !input.passengerPersonalLiabilityFallback;
  return { activeServiceContinues, futureAction: authorised ? 'ALLOW' : 'OPEN_FUNDING_EXCEPTION', personalLiabilityCreated: false };
}

export function evaluateHospitalPassengerReadiness(input: {
  readonly state: PassengerReadyState;
  readonly authorisedReadinessContact: boolean;
  readonly readinessContactRequestedPaymentChange: boolean;
  readonly operationalAssistanceDataOnly: boolean;
  readonly passengerNotReadyRelabelledNoShow: boolean;
  readonly driverReleasedAfterLongDelay: boolean;
  readonly driverCancellationFalselyRecorded: boolean;
  readonly emergencyMedicalCapabilityClaimed: boolean;
}): { readonly allowed: boolean; readonly noShowRecorded: false } {
  return {
    allowed: PASSENGER_READY_STATES.includes(input.state) && input.authorisedReadinessContact
      && !input.readinessContactRequestedPaymentChange && input.operationalAssistanceDataOnly
      && !input.passengerNotReadyRelabelledNoShow
      && (!input.driverReleasedAfterLongDelay || !input.driverCancellationFalselyRecorded)
      && !input.emergencyMedicalCapabilityClaimed,
    noShowRecorded: false
  };
}

export function evaluateEmployerFundedVisibility(input: {
  readonly businessPurposeAndFundingScopeCurrent: boolean;
  readonly fundedJourneyVisible: boolean;
  readonly unrelatedPersonalJourneyVisible: boolean;
  readonly safetyOrPersonalDataVisibleToApprover: boolean;
  readonly employmentEnded: boolean;
  readonly futureOrganisationAuthorityRemoved: boolean;
  readonly personalAccountDeleted: boolean;
}): boolean {
  return input.businessPurposeAndFundingScopeCurrent && input.fundedJourneyVisible
    && !input.unrelatedPersonalJourneyVisible && !input.safetyOrPersonalDataVisibleToApprover
    && (!input.employmentEnded || input.futureOrganisationAuthorityRemoved)
    && !input.personalAccountDeleted;
}

export function evaluateGuestPassengerProfile(input: {
  readonly bookingOrOrganisationScopePresent: boolean;
  readonly minimumDataOnly: boolean;
  readonly bookerPassengerPayerSeparated: boolean;
  readonly smartphoneRequired: boolean;
  readonly indefiniteShadowProfileCreated: boolean;
  readonly personalAccountLinkRequested: boolean;
  readonly controlledClaimLinkCompleted: boolean;
}): boolean {
  return input.bookingOrOrganisationScopePresent && input.minimumDataOnly
    && input.bookerPassengerPayerSeparated && !input.smartphoneRequired
    && !input.indefiniteShadowProfileCreated
    && (!input.personalAccountLinkRequested || input.controlledClaimLinkCompleted);
}

export function evaluateInstitutionalLiveChange(input: {
  readonly requesterAuthorityCurrent: boolean;
  readonly passengerOnboard: boolean;
  readonly thirdPartyRedirectPermitted: boolean;
  readonly canonicalJourneyAmendmentUsed: boolean;
  readonly schoolGuardianChangeAuthorisedOrNotApplicable: boolean;
  readonly eligibilityRevalidatedAfterMaterialChange: boolean;
  readonly freeTextTreatedAsAuthoritativeState: boolean;
}): boolean {
  if (!input.requesterAuthorityCurrent || !input.canonicalJourneyAmendmentUsed || input.freeTextTreatedAsAuthoritativeState) return false;
  if (input.passengerOnboard && !input.thirdPartyRedirectPermitted) return false;
  return input.schoolGuardianChangeAuthorisedOrNotApplicable && input.eligibilityRevalidatedAfterMaterialChange;
}

export function evaluateInstitutionalOutcome(input: {
  readonly canonicalOutcome: InstitutionalLiveOutcome;
  readonly requestedOutcome: InstitutionalLiveOutcome;
  readonly accessibilityBoardingTimeRelabelledNoShow: boolean;
  readonly financeUsesCanonicalOutcome: boolean;
  readonly slaUsesCanonicalOutcome: boolean;
}): { readonly allowed: boolean; readonly relabelled: false } {
  return {
    allowed: input.canonicalOutcome === input.requestedOutcome
      && !input.accessibilityBoardingTimeRelabelledNoShow
      && input.financeUsesCanonicalOutcome && input.slaUsesCanonicalOutcome,
    relabelled: false
  };
}

export function evaluateInstitutionalBreakdown(input: {
  readonly passengerContinuityCaseCreated: boolean;
  readonly vehicleRescueCaseCreated: boolean;
  readonly replacementCreatedNewCustomerBooking: boolean;
  readonly originalBookingAndJourneyPreserved: boolean;
  readonly passengerAccessibilitySchoolContractRequirementsRevalidated: boolean;
  readonly ordinaryApprovalWouldStrandPassenger: boolean;
  readonly continuityBlockedByOrdinaryApproval: boolean;
}): boolean {
  return input.passengerContinuityCaseCreated && input.vehicleRescueCaseCreated
    && !input.replacementCreatedNewCustomerBooking && input.originalBookingAndJourneyPreserved
    && input.passengerAccessibilitySchoolContractRequirementsRevalidated
    && (!input.ordinaryApprovalWouldStrandPassenger || !input.continuityBlockedByOrdinaryApproval);
}

export function evaluateInstitutionalSafetyLink(input: {
  readonly specialisedSafetyCaseAuthoritative: boolean;
  readonly organisationAttemptedSuppressDowngradeOrClose: boolean;
  readonly disclosurePurposeAndAuthorityRecorded: boolean;
  readonly temporaryRestrictionExposedAsCustomerAdminButton: boolean;
  readonly allegationLabelledAndAssessed: boolean;
}): boolean {
  return input.specialisedSafetyCaseAuthoritative
    && !input.organisationAttemptedSuppressDowngradeOrClose
    && input.disclosurePurposeAndAuthorityRecorded
    && !input.temporaryRestrictionExposedAsCustomerAdminButton
    && input.allegationLabelledAndAssessed;
}

export function evaluateInstitutionalComplianceEvidence(input: {
  readonly authoritativeSourceVersionsRecorded: boolean;
  readonly generatedAtAndScopeRecorded: boolean;
  readonly narrowAttestationSufficient: boolean;
  readonly rawRestrictedDocumentsIncluded: boolean;
  readonly expiredOrSupersededEvidenceLabelled: boolean;
  readonly releaseAudited: boolean;
  readonly assignmentTimeEligibilityEvaluated: boolean;
}): boolean {
  return input.authoritativeSourceVersionsRecorded && input.generatedAtAndScopeRecorded
    && input.narrowAttestationSufficient && !input.rawRestrictedDocumentsIncluded
    && input.expiredOrSupersededEvidenceLabelled && input.releaseAudited
    && input.assignmentTimeEligibilityEvaluated;
}

export function evaluateInstitutionalDataQuality(input: {
  readonly issueType: 'MISSING_CONTACT' | 'STALE_FUNDING' | 'INVALID_SITE_ADDRESS' | 'DUPLICATE_RELATIONSHIP' | 'SCHEDULE_OVERLAP' | 'UNRESOLVED_PASSENGER_REQUIREMENT';
  readonly critical: boolean;
  readonly issueRecorded: boolean;
  readonly occurrenceGenerationOrDispatchBlockedWhenRequired: boolean;
  readonly operatorInventedMissingData: boolean;
  readonly correctionVersionedAndAudited: boolean;
}): boolean {
  return input.issueRecorded && (!input.critical || input.occurrenceGenerationOrDispatchBlockedWhenRequired)
    && !input.operatorInventedMissingData && input.correctionVersionedAndAudited;
}

export function evaluateOrganisationSiteDisruption(input: {
  readonly structuredSiteProfileCurrent: boolean;
  readonly disruptionScopeAndTimeRecorded: boolean;
  readonly affectedFutureBookingsEvaluated: boolean;
  readonly geofenceTreatedAsAbsoluteProof: boolean;
  readonly authorisedChangesCommunicated: boolean;
  readonly schoolSeriesDestroyedForOneClosure: boolean;
}): boolean {
  return input.structuredSiteProfileCurrent && input.disruptionScopeAndTimeRecorded
    && input.affectedFutureBookingsEvaluated && !input.geofenceTreatedAsAbsoluteProof
    && input.authorisedChangesCommunicated && !input.schoolSeriesDestroyedForOneClosure;
}

export function evaluatePartnerOverflow(input: {
  readonly partnerAgreementCurrent: boolean;
  readonly driverAndVehicleEligible: boolean;
  readonly equivalentAccessibilitySafeguardingAndServiceControls: boolean;
  readonly canonicalDazatBookingAndJourneyRetained: boolean;
  readonly sufficientStatusEventsReturned: boolean;
  readonly partnerFailureBlamedOnPassenger: boolean;
  readonly wholeOrganisationRosterShared: boolean;
}): boolean {
  return input.partnerAgreementCurrent && input.driverAndVehicleEligible
    && input.equivalentAccessibilitySafeguardingAndServiceControls
    && input.canonicalDazatBookingAndJourneyRetained && input.sufficientStatusEventsReturned
    && !input.partnerFailureBlamedOnPassenger && !input.wholeOrganisationRosterShared;
}

export function evaluateInstitutionalDegradedMode(input: {
  readonly activeJourneysAndSafetyPrioritised: boolean;
  readonly canonicalContingencyInterfaceUsed: boolean;
  readonly shadowSpreadsheetOrPersonalMessagingUsed: boolean;
  readonly contingencyRecordsUniquelyIdentified: boolean;
  readonly recoveryDeduplicatesAndReconciles: boolean;
  readonly blindPaymentRetryPerformed: boolean;
  readonly shieldRiskyChangesPaused: boolean;
}): boolean {
  return input.activeJourneysAndSafetyPrioritised && input.canonicalContingencyInterfaceUsed
    && !input.shadowSpreadsheetOrPersonalMessagingUsed
    && input.contingencyRecordsUniquelyIdentified && input.recoveryDeduplicatesAndReconciles
    && !input.blindPaymentRetryPerformed && input.shieldRiskyChangesPaused;
}

export function evaluateInstitutionalSecurityContainment(input: {
  readonly riskDecision: 'LIMIT' | 'STEP_UP' | 'HOLD' | 'REVIEW';
  readonly riskyCapabilityScoped: boolean;
  readonly compromisedSessionOrCredentialRevoked: boolean;
  readonly validActiveJourneysContinueSafely: boolean;
  readonly highRiskChangeHeld: boolean;
  readonly trustedContactSafeNotificationPlanned: boolean;
}): boolean {
  return input.riskyCapabilityScoped && input.compromisedSessionOrCredentialRevoked
    && input.validActiveJourneysContinueSafely && input.highRiskChangeHeld
    && input.trustedContactSafeNotificationPlanned;
}

export function evaluateInstitutionalPrivacyAndAi(input: {
  readonly trackingPurposeCurrentAndAuthorised: boolean;
  readonly trackingAccessConfiguredToExpireAfterNeed: boolean;
  readonly generalEmployeeTrackingAttempted: boolean;
  readonly unrelatedHistoryDisclosed: boolean;
  readonly aiAction: 'SUMMARISE' | 'SUGGEST_CONFLICT_RESOLUTION' | 'DRAFT_COMMUNICATION' | 'RETRIEVE_POLICY' | 'INVENT_AUTHORITY' | 'TERMINATE_CONTRACT' | 'CLOSE_SAFEGUARDING';
}): boolean {
  return input.trackingPurposeCurrentAndAuthorised && input.trackingAccessConfiguredToExpireAfterNeed
    && !input.generalEmployeeTrackingAttempted && !input.unrelatedHistoryDisclosed
    && ['SUMMARISE', 'SUGGEST_CONFLICT_RESOLUTION', 'DRAFT_COMMUNICATION', 'RETRIEVE_POLICY'].includes(input.aiAction);
}

export function evaluateOrganisationServiceHealth(input: {
  readonly dimensionsVersionedAndEvidenceBacked: boolean;
  readonly safetySeverityBlendedIntoCustomerScore: boolean;
  readonly punitiveMysteryScoreCreated: boolean;
  readonly poorStatusAutomaticallyCancelledBooking: boolean;
  readonly consequencesAppliedOnlyThroughCanonicalDomainPolicy: boolean;
}): boolean {
  return input.dimensionsVersionedAndEvidenceBacked
    && !input.safetySeverityBlendedIntoCustomerScore && !input.punitiveMysteryScoreCreated
    && !input.poorStatusAutomaticallyCancelledBooking
    && input.consequencesAppliedOnlyThroughCanonicalDomainPolicy;
}

export function evaluateInstitutionalShiftHandover(input: {
  readonly criticalItemsStructured: boolean;
  readonly incomingOperatorAcceptedP0P1Ownership: boolean;
  readonly criticalWorkOnlyInFreeText: boolean;
  readonly promisedCapabilityExistsAndAcceptanceTested: boolean;
  readonly unsupportedGuaranteePromised: boolean;
}): boolean {
  return input.criticalItemsStructured && input.incomingOperatorAcceptedP0P1Ownership
    && !input.criticalWorkOnlyInFreeText
    && input.promisedCapabilityExistsAndAcceptanceTested && !input.unsupportedGuaranteePromised;
}

export function evaluateInstitutionLaunchReadiness(input: {
  readonly signedAgreementPresent: boolean;
  readonly agreementPolicyReady: boolean;
  readonly billingFundingReady: boolean;
  readonly usersContactsRosterSchedulesReady: boolean;
  readonly specialistAndSafeguardingControlsReady: boolean;
  readonly communicationsPortalSupportContingencyReady: boolean;
  readonly failedGatesHaveActionPlansOrNoneFailed: boolean;
  readonly salesPressureChangedReadyStatus: boolean;
  readonly pilotRequired: boolean;
  readonly pilotGatePassed: boolean;
  readonly authorisedRiskAcceptanceRecorded: boolean;
}): { readonly ready: boolean; readonly signedContractAloneSufficient: false } {
  const gates = input.agreementPolicyReady && input.billingFundingReady
    && input.usersContactsRosterSchedulesReady && input.specialistAndSafeguardingControlsReady
    && input.communicationsPortalSupportContingencyReady;
  const pilotSatisfied = !input.pilotRequired || input.pilotGatePassed || input.authorisedRiskAcceptanceRecorded;
  return {
    ready: input.signedAgreementPresent && gates && input.failedGatesHaveActionPlansOrNoneFailed
      && !input.salesPressureChangedReadyStatus && pilotSatisfied,
    signedContractAloneSufficient: false
  };
}

export function evaluateInstitutionExitPlan(input: {
  readonly inventoryComplete: boolean;
  readonly newBookingStopTimeRecorded: boolean;
  readonly futureBookingDispositionRecorded: boolean;
  readonly accessRevocationTimed: boolean;
  readonly lawfulRecordsAndOpenCasesPreserved: boolean;
  readonly governedExportProcessUsed: boolean;
  readonly activePassengerAbandoned: boolean;
}): { readonly allowed: boolean; readonly activePassengerAbandoned: false } {
  return {
    allowed: input.inventoryComplete && input.newBookingStopTimeRecorded
      && input.futureBookingDispositionRecorded && input.accessRevocationTimed
      && input.lawfulRecordsAndOpenCasesPreserved && input.governedExportProcessUsed
      && !input.activePassengerAbandoned,
    activePassengerAbandoned: false
  };
}

export function institutionalLiveAcceptanceScenarioMayPass(input: {
  readonly scenario: InstitutionalLiveAcceptanceScenario;
  readonly canonicalBookingJourneyDispatchPreserved: boolean;
  readonly hardEligibilityAndSafetyPreserved: boolean;
  readonly tenantRolePurposeScopePreserved: boolean;
  readonly outcomeClassificationPreserved: boolean;
  readonly activePassengerContinuityPreserved: boolean;
  readonly auditAndIdempotencyPreserved: boolean;
  readonly shadowSystemUsed: boolean;
}): boolean {
  return INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS.includes(input.scenario)
    && input.canonicalBookingJourneyDispatchPreserved && input.hardEligibilityAndSafetyPreserved
    && input.tenantRolePurposeScopePreserved && input.outcomeClassificationPreserved
    && input.activePassengerContinuityPreserved && input.auditAndIdempotencyPreserved
    && !input.shadowSystemUsed;
}

export const INSTITUTIONAL_SHADOW_TRIP_SYSTEM_ALLOWED = false as const;
export const MANUAL_DISPATCH_BYPASSES_HARD_ELIGIBILITY = false as const;
export const ORGANISATION_MAY_CLOSE_SAFETY_CASE = false as const;
export const SERVICE_HEALTH_AUTOMATICALLY_CANCELS_BOOKING = false as const;
export const SHADOW_SPREADSHEET_DISPATCH_ALLOWED = false as const;
export const INSTITUTIONAL_AI_INVENTS_AUTHORITY = false as const;
export const SIGNED_CONTRACT_ALONE_ENABLES_LAUNCH = false as const;
export const CONTRACT_EXIT_MAY_ABANDON_ACTIVE_PASSENGER = false as const;
export const INSTITUTIONAL_LIVE_MUTATIONS_ENABLED = false as const;
