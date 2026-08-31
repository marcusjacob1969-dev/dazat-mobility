export const ORGANISATION_PASSENGER_MEMBERSHIP_STATES = [
  'PENDING', 'ACTIVE', 'TEMPORARILY_INACTIVE', 'EXPIRED', 'REMOVED'
] as const;
export type OrganisationPassengerMembershipState = (typeof ORGANISATION_PASSENGER_MEMBERSHIP_STATES)[number];

export const INSTITUTIONAL_SERVICE_TYPES = [
  'STANDARD', 'WAV', 'ASSISTED', 'SCHOOL_TRANSPORT', 'AIRPORT',
  'BUSINESS', 'EXECUTIVE', 'OTHER_CONFIGURED_SERVICE'
] as const;
export type InstitutionalServiceType = (typeof INSTITUTIONAL_SERVICE_TYPES)[number];

export const BOOKING_SERIES_CHANGE_SCOPES = [
  'THIS_OCCURRENCE_ONLY', 'THIS_AND_FUTURE_OCCURRENCES', 'ENTIRE_SERIES'
] as const;
export type BookingSeriesChangeScope = (typeof BOOKING_SERIES_CHANGE_SCOPES)[number];

export const BULK_PASSENGER_IMPORT_STATES = [
  'UPLOADED', 'VALIDATING', 'VALIDATED_WITH_WARNINGS', 'REJECTED',
  'READY_TO_COMMIT', 'COMMITTED', 'PARTIALLY_COMMITTED'
] as const;

export const INSTITUTIONAL_CANCELLATION_REASONS = [
  'PASSENGER_UNAVAILABLE', 'ORGANISATION_CANCELLED', 'APPOINTMENT_CANCELLED',
  'SCHOOL_CLOSED', 'SERVICE_NO_LONGER_REQUIRED', 'DUPLICATE_BOOKING',
  'OTHER_STRUCTURED_REASON'
] as const;
export type InstitutionalCancellationReason = (typeof INSTITUTIONAL_CANCELLATION_REASONS)[number];

export const ORGANISATION_TRANSPORT_EXCEPTION_TYPES = [
  'MISSING_BOOKING_AUTHORITY', 'FUNDING_EXPIRED', 'SERVICE_REQUIREMENT_UNAVAILABLE',
  'PASSENGER_CONTACT_UNAVAILABLE', 'SCHEDULE_CONFLICT', 'NO_ELIGIBLE_DRIVER',
  'APPROVAL_REQUIRED', 'ROSTER_EXPIRED', 'DATA_VALIDATION_ERROR'
] as const;

export const INSTITUTIONAL_TRANSPORT_API_PATHS = [
  '/organisations/{id}/passengers', '/organisations/{id}/passenger-memberships',
  '/organisations/{id}/booking-authorities', '/organisations/{id}/funding-authorisations',
  '/organisations/{id}/service-eligibility', '/organisations/{id}/booking-templates',
  '/organisations/{id}/booking-series', '/organisations/{id}/booking-batches',
  '/organisations/{id}/transport-exceptions', '/organisations/{id}/calendars'
] as const;

export const INSTITUTIONAL_TRANSPORT_COMMANDS = [
  'AddPassengerToRoster', 'RemovePassengerFromRoster', 'UpdatePassengerRequirements',
  'GrantBookingAuthority', 'RevokeBookingAuthority', 'CreateFundingAuthorisation',
  'CreateBookingTemplate', 'GenerateBookingOccurrences', 'AmendBookingSeries',
  'CreateInstitutionalBooking', 'ImportPassengerRoster', 'CreateBulkBookingBatch',
  'ResolveTransportException', 'MarkPassengerReady', 'CancelInstitutionalBooking'
] as const;

export const INSTITUTIONAL_TRANSPORT_EVENTS = [
  'PassengerRosterMembershipCreated.v1', 'PassengerRosterMembershipEnded.v1',
  'PassengerRequirementsChanged.v1', 'BookingAuthorityGranted.v1',
  'BookingAuthorityRevoked.v1', 'FundingAuthorisationActivated.v1',
  'FundingAuthorisationExpired.v1', 'BookingTemplateCreated.v1',
  'BookingTemplateVersioned.v1', 'BookingOccurrenceGenerated.v1',
  'BookingSeriesAmended.v1', 'BulkPassengerImportValidated.v1',
  'BulkPassengerImportCommitted.v1', 'BulkBookingBatchCommitted.v1',
  'InstitutionalBookingCreated.v1', 'PassengerMarkedReady.v1',
  'OrganisationTransportExceptionOpened.v1', 'OrganisationTransportExceptionResolved.v1'
] as const;

export const INSTITUTIONAL_TRANSPORT_P0_REQUIREMENTS = [
  'ORG-PAX-001', 'ORG-PAX-002', 'ORG-AUTH-002', 'ORG-ACC-002',
  'ORG-REC-001', 'ORG-REC-002', 'ORG-SCH-002', 'ORG-SCH-003',
  'ORG-SCH-004', 'ORG-HLT-001', 'ORG-AUT-001', 'ORG-BULK-001',
  'ORG-BULK-002', 'ORG-SCHD-001', 'ORG-SCHD-002', 'ORG-NSH-001',
  'ORG-JRN-001', 'ORG-REP-001', 'ORG-AUD-002'
] as const;

export const INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS = [
  'MULTI_ORGANISATION_PASSENGER_ISOLATION', 'ROSTER_REMOVAL_PRESERVES_IDENTITY',
  'EXPIRED_FUNDING_ROUTES_TO_EXCEPTION', 'TEN_CANONICAL_RECURRING_OCCURRENCES',
  'ONE_OCCURRENCE_CHANGE_ISOLATED', 'FUTURE_SERIES_CHANGE_PRESERVES_HISTORY',
  'SCHOOL_CLOSURE_STRUCTURED_BULK_CHANGE', 'INELIGIBLE_PREFERRED_DRIVER_REPLACED',
  'WAV_DOWNGRADE_REJECTED', 'BULK_DUPLICATES_ROW_LEVEL_NO_LEAKAGE',
  'BULK_REPLAY_DEDUPLICATED', 'HOSPITAL_NOT_READY_NOT_NO_SHOW',
  'LATER_READY_USES_CURRENT_STATE', 'FUTURE_PASSENGER_SUBSTITUTION_REVALIDATED',
  'ACTIVE_JOURNEY_PASSENGER_RELABEL_REJECTED', 'BREAKDOWN_PRESERVES_CANONICAL_JOURNEY',
  'INSTITUTIONAL_REPORT_MINIMISED', 'ROSTER_END_DISPOSES_FUTURE_PRESERVES_HISTORY'
] as const;
export type InstitutionalTransportAcceptanceScenario = (typeof INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS)[number];

export function evaluateManagedPassengerRelationship(input: {
  readonly organisationId: string;
  readonly relationshipOrganisationId: string;
  readonly passengerIdentityExistsIndependently: boolean;
  readonly organisationClaimsPassengerOwnership: boolean;
  readonly localReferenceExposedAsGlobalIdentity: boolean;
  readonly otherOrganisationRelationshipsDisclosed: boolean;
  readonly purposeAndAuthorityBasisRecorded: boolean;
  readonly minimumTransportDataOnly: boolean;
  readonly diagnosisStoredByDefault: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly passengerIdentityOwnedByOrganisation: false } {
  const blockers: string[] = [];
  if (input.organisationId !== input.relationshipOrganisationId) blockers.push('PASSENGER_RELATIONSHIP_TENANT_MISMATCH');
  if (!input.passengerIdentityExistsIndependently) blockers.push('INDEPENDENT_PASSENGER_IDENTITY_REQUIRED');
  if (input.organisationClaimsPassengerOwnership) blockers.push('ORGANISATION_PASSENGER_OWNERSHIP_PROHIBITED');
  if (input.localReferenceExposedAsGlobalIdentity) blockers.push('LOCAL_REFERENCE_MUST_REMAIN_TENANT_LOCAL');
  if (input.otherOrganisationRelationshipsDisclosed) blockers.push('CROSS_TENANT_PASSENGER_RELATIONSHIP_DISCLOSURE');
  if (!input.purposeAndAuthorityBasisRecorded) blockers.push('RELATIONSHIP_PURPOSE_AND_AUTHORITY_REQUIRED');
  if (!input.minimumTransportDataOnly || input.diagnosisStoredByDefault) blockers.push('TRANSPORT_DATA_MINIMISATION_REQUIRED');
  return { allowed: blockers.length === 0, blockers, passengerIdentityOwnedByOrganisation: false };
}

export function evaluateInstitutionalBookingAuthority(input: {
  readonly membershipActiveAndCurrent: boolean;
  readonly bookingAuthorityActive: boolean;
  readonly passengerWithinAuthorityScope: boolean;
  readonly fundingRequired: boolean;
  readonly fundingAuthorisationActive: boolean;
  readonly fundingScopeMatches: boolean;
  readonly serviceEligibilityCurrent: boolean;
  readonly organisationAgreementCurrent: boolean;
  readonly requestedPersonalPassengerFallback: boolean;
}): {
  readonly action: 'CREATE_CANONICAL_BOOKING' | 'OPEN_FUNDING_OR_APPROVAL_EXCEPTION' | 'DENY';
  readonly blockers: readonly string[];
  readonly passengerPersonalLiabilityCreated: false;
} {
  const blockers: string[] = [];
  if (!input.membershipActiveAndCurrent) blockers.push('ACTIVE_PASSENGER_MEMBERSHIP_REQUIRED');
  if (!input.bookingAuthorityActive || !input.passengerWithinAuthorityScope) blockers.push('BOOKING_AUTHORITY_REQUIRED');
  if (!input.serviceEligibilityCurrent) blockers.push('CURRENT_SERVICE_ELIGIBILITY_REQUIRED');
  if (!input.organisationAgreementCurrent) blockers.push('CURRENT_ORGANISATION_AGREEMENT_REQUIRED');
  if (input.requestedPersonalPassengerFallback) blockers.push('PERSONAL_PASSENGER_LIABILITY_FALLBACK_PROHIBITED');
  const fundingMissing = input.fundingRequired && (!input.fundingAuthorisationActive || !input.fundingScopeMatches);
  if (fundingMissing) blockers.push('FUNDING_AUTHORISATION_REQUIRED');
  const authorityBlocked = blockers.some((value) => value !== 'FUNDING_AUTHORISATION_REQUIRED');
  return {
    action: authorityBlocked ? 'DENY' : fundingMissing ? 'OPEN_FUNDING_OR_APPROVAL_EXCEPTION' : 'CREATE_CANONICAL_BOOKING',
    blockers,
    passengerPersonalLiabilityCreated: false
  };
}

export function evaluateInstitutionalServiceEligibility(input: {
  readonly requestedServiceType: InstitutionalServiceType;
  readonly passengerRequirementsSatisfied: boolean;
  readonly organisationAgreementAllowsService: boolean;
  readonly regionAndTimeAllowed: boolean;
  readonly driverPermissionCurrent: boolean;
  readonly vehicleCapabilityCurrent: boolean;
  readonly requiredAccessibilityPreserved: boolean;
  readonly safeguardingAndHandoverPreserved: boolean;
  readonly evaluationStage: 'BOOKING_CREATE' | 'DISPATCH' | 'REASSIGNMENT';
}): { readonly eligible: boolean; readonly exception: 'NONE' | 'NO_ELIGIBLE_SERVICE' | 'NO_ELIGIBLE_DRIVER'; readonly requirementsDowngraded: false } {
  if (!input.requiredAccessibilityPreserved || !input.safeguardingAndHandoverPreserved
      || !input.passengerRequirementsSatisfied || !input.organisationAgreementAllowsService
      || !input.regionAndTimeAllowed) {
    return { eligible: false, exception: 'NO_ELIGIBLE_SERVICE', requirementsDowngraded: false };
  }
  if (!input.driverPermissionCurrent || !input.vehicleCapabilityCurrent) {
    return { eligible: false, exception: 'NO_ELIGIBLE_DRIVER', requirementsDowngraded: false };
  }
  return { eligible: true, exception: 'NONE', requirementsDowngraded: false };
}

export function evaluateBookingOccurrenceGeneration(input: {
  readonly templateActiveAndCurrent: boolean;
  readonly recurrenceStructured: boolean;
  readonly calendarVersionRecorded: boolean;
  readonly generationHorizonAllowed: boolean;
  readonly requestedOccurrenceCount: number;
  readonly uniqueCanonicalBookingCount: number;
  readonly templateVersionStoredOnEveryOccurrence: boolean;
  readonly agreementAndPolicyVersionsStored: boolean;
  readonly driverReservedByTemplate: boolean;
  readonly financeLiabilityCreatedByTemplate: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly templateIsCanonicalBooking: false } {
  const blockers: string[] = [];
  if (!Number.isSafeInteger(input.requestedOccurrenceCount) || input.requestedOccurrenceCount < 1) {
    throw new Error('Requested occurrence count must be a positive safe integer');
  }
  if (!input.templateActiveAndCurrent) blockers.push('ACTIVE_BOOKING_TEMPLATE_REQUIRED');
  if (!input.recurrenceStructured) blockers.push('STRUCTURED_RECURRENCE_REQUIRED');
  if (!input.calendarVersionRecorded) blockers.push('CALENDAR_VERSION_REQUIRED');
  if (!input.generationHorizonAllowed) blockers.push('GENERATION_HORIZON_EXCEEDED');
  if (input.uniqueCanonicalBookingCount !== input.requestedOccurrenceCount) blockers.push('ONE_CANONICAL_BOOKING_PER_OCCURRENCE_REQUIRED');
  if (!input.templateVersionStoredOnEveryOccurrence || !input.agreementAndPolicyVersionsStored) {
    blockers.push('GENERATION_PROVENANCE_REQUIRED');
  }
  if (input.driverReservedByTemplate) blockers.push('TEMPLATE_CANNOT_RESERVE_DRIVER');
  if (input.financeLiabilityCreatedByTemplate) blockers.push('TEMPLATE_CANNOT_CREATE_FINANCE_LIABILITY');
  return { allowed: blockers.length === 0, blockers, templateIsCanonicalBooking: false };
}

export function evaluateBookingSeriesAmendment(input: {
  readonly scope: BookingSeriesChangeScope;
  readonly scopePermitted: boolean;
  readonly completedBookingsChanged: boolean;
  readonly activeJourneyChangedThroughSeries: boolean;
  readonly futureOccurrencesUseNewTemplateVersion: boolean;
  readonly unaffectedOccurrencesPreserved: boolean;
  readonly passengerRequirementsPreserved: boolean;
  readonly fundingRevalidatedWhenMaterial: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (!input.scopePermitted) blockers.push('SERIES_CHANGE_SCOPE_NOT_PERMITTED');
  if (input.completedBookingsChanged) blockers.push('COMPLETED_BOOKING_IMMUTABLE');
  if (input.activeJourneyChangedThroughSeries) blockers.push('ACTIVE_JOURNEY_REQUIRES_CANONICAL_AMENDMENT');
  if (input.scope !== 'THIS_OCCURRENCE_ONLY' && !input.futureOccurrencesUseNewTemplateVersion) blockers.push('NEW_TEMPLATE_VERSION_REQUIRED');
  if (!input.unaffectedOccurrencesPreserved) blockers.push('UNAFFECTED_OCCURRENCES_MUST_REMAIN_UNCHANGED');
  if (!input.passengerRequirementsPreserved) blockers.push('PASSENGER_REQUIREMENTS_MUST_PERSIST');
  if (!input.fundingRevalidatedWhenMaterial) blockers.push('MATERIAL_CHANGE_FUNDING_REVALIDATION_REQUIRED');
  return { allowed: blockers.length === 0, blockers };
}

export function evaluateSchoolInstitutionalSchedule(input: {
  readonly structuredTermCalendar: boolean;
  readonly closureAndExceptionDatesApplied: boolean;
  readonly preferredDriverEligibleNow: boolean;
  readonly selectedDriverEligibleNow: boolean;
  readonly selectedVehicleEligibleNow: boolean;
  readonly accessibilityRequirementsPreserved: boolean;
  readonly handoverRulesPreservedPerOccurrence: boolean;
  readonly familiarityUsedOnlyAsRankingPreference: boolean;
}): { readonly allowed: boolean; readonly preferredDriverMayBeUsed: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (!input.structuredTermCalendar || !input.closureAndExceptionDatesApplied) blockers.push('STRUCTURED_SCHOOL_CALENDAR_REQUIRED');
  if (!input.selectedDriverEligibleNow || !input.selectedVehicleEligibleNow) blockers.push('CURRENT_DRIVER_VEHICLE_ELIGIBILITY_REQUIRED');
  if (!input.accessibilityRequirementsPreserved || !input.handoverRulesPreservedPerOccurrence) blockers.push('SCHOOL_REQUIREMENTS_MUST_PERSIST');
  if (!input.familiarityUsedOnlyAsRankingPreference) blockers.push('FAMILIARITY_CANNOT_OVERRIDE_HARD_ELIGIBILITY');
  return { allowed: blockers.length === 0, preferredDriverMayBeUsed: input.preferredDriverEligibleNow && blockers.length === 0, blockers };
}

export function evaluateScheduledInstitutionalCapacity(input: {
  readonly requiredCapability: string;
  readonly reservedCapability: string;
  readonly activeAssignmentsChecked: boolean;
  readonly earlierScheduledWorkChecked: boolean;
  readonly travelTimeChecked: boolean;
  readonly maintenanceChecked: boolean;
  readonly fatigueAndRestChecked: boolean;
  readonly serviceCommitmentsChecked: boolean;
  readonly scheduleConflictPresent: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly rowAttachmentProvesCapacity: false } {
  const blockers: string[] = [];
  if (input.requiredCapability !== input.reservedCapability) blockers.push('CAPABILITY_AWARE_CAPACITY_REQUIRED');
  if (!input.activeAssignmentsChecked || !input.earlierScheduledWorkChecked || !input.travelTimeChecked
      || !input.maintenanceChecked || !input.fatigueAndRestChecked || !input.serviceCommitmentsChecked) {
    blockers.push('COMPLETE_DRIVER_SCHEDULE_CHECK_REQUIRED');
  }
  if (input.scheduleConflictPresent) blockers.push('DRIVER_SCHEDULE_CONFLICT');
  return { allowed: blockers.length === 0, blockers, rowAttachmentProvesCapacity: false };
}

export function evaluatePassengerReadiness(input: {
  readonly readiness: 'NOT_READY' | 'READY';
  readonly authoritativeStateCurrent: boolean;
  readonly withinScheduledPickupWindow: boolean;
  readonly servicePolicyAllowsWaiting: boolean;
  readonly automaticallyRecordedNoShow: boolean;
  readonly guaranteedInstantCollectionClaimed: boolean;
}): { readonly action: 'WAIT' | 'RELEASE_TO_SCHEDULING' | 'OPEN_EXCEPTION'; readonly passengerNoShowRecorded: false } {
  if (!input.authoritativeStateCurrent || input.guaranteedInstantCollectionClaimed) {
    return { action: 'OPEN_EXCEPTION', passengerNoShowRecorded: false };
  }
  if (input.readiness === 'NOT_READY') {
    return { action: input.withinScheduledPickupWindow && input.servicePolicyAllowsWaiting && !input.automaticallyRecordedNoShow ? 'WAIT' : 'OPEN_EXCEPTION', passengerNoShowRecorded: false };
  }
  return { action: 'RELEASE_TO_SCHEDULING', passengerNoShowRecorded: false };
}

export function evaluateInstitutionalBulkCommit(input: {
  readonly dryRunCompleted: boolean;
  readonly everyRowHasVisibleOutcome: boolean;
  readonly duplicateDetectionCompleted: boolean;
  readonly crossTenantRelationshipDisclosed: boolean;
  readonly idempotencyKeyPresent: boolean;
  readonly replayedCommit: boolean;
  readonly policyAllowsPartialCommit: boolean;
  readonly partialCommitRequested: boolean;
  readonly malformedRowSilentlyIgnored: boolean;
}): { readonly allowed: boolean; readonly deduplicated: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (!input.dryRunCompleted) blockers.push('DRY_RUN_REQUIRED');
  if (!input.everyRowHasVisibleOutcome) blockers.push('ROW_LEVEL_OUTCOMES_REQUIRED');
  if (!input.duplicateDetectionCompleted) blockers.push('DUPLICATE_DETECTION_REQUIRED');
  if (input.crossTenantRelationshipDisclosed) blockers.push('CROSS_TENANT_DUPLICATE_DISCLOSURE_PROHIBITED');
  if (!input.idempotencyKeyPresent) blockers.push('IDEMPOTENCY_KEY_REQUIRED');
  if (input.partialCommitRequested && !input.policyAllowsPartialCommit) blockers.push('PARTIAL_COMMIT_NOT_PERMITTED');
  if (input.malformedRowSilentlyIgnored) blockers.push('AMBIGUOUS_PARTIAL_RESULT_PROHIBITED');
  if (input.replayedCommit) blockers.push('BULK_COMMIT_REPLAY_DEDUPLICATED');
  return { allowed: blockers.length === 0, deduplicated: input.replayedCommit, blockers };
}

export function evaluateInstitutionalPassengerSubstitution(input: {
  readonly activeJourney: boolean;
  readonly authorisedPassengerRelationship: boolean;
  readonly serviceEligibilityRevalidated: boolean;
  readonly requirementsRevalidated: boolean;
  readonly fundingRevalidated: boolean;
  readonly communicationsRevalidated: boolean;
  readonly rideCheckAndBookingPartyRulesApplied: boolean;
}): { readonly allowed: boolean; readonly canonicalWorkflowRequired: boolean } {
  if (input.activeJourney) return { allowed: false, canonicalWorkflowRequired: true };
  const allowed = input.authorisedPassengerRelationship && input.serviceEligibilityRevalidated
    && input.requirementsRevalidated && input.fundingRevalidated && input.communicationsRevalidated
    && input.rideCheckAndBookingPartyRulesApplied;
  return { allowed, canonicalWorkflowRequired: true };
}

export function evaluateInstitutionalCancellation(input: {
  readonly reason: InstitutionalCancellationReason;
  readonly canonicalBookingTransitionUsed: boolean;
  readonly serviceSpecificNoShowPolicyUsed: boolean;
  readonly passengerNotReadyMisclassifiedAsNoShow: boolean;
  readonly activeJourneyCancelledThroughPortal: boolean;
  readonly contractualChargeCalculatedByFinance: boolean;
}): { readonly allowed: boolean; readonly portalCalculatesCancellationCharge: false } {
  return {
    allowed: INSTITUTIONAL_CANCELLATION_REASONS.includes(input.reason)
      && input.canonicalBookingTransitionUsed && input.serviceSpecificNoShowPolicyUsed
      && !input.passengerNotReadyMisclassifiedAsNoShow && !input.activeJourneyCancelledThroughPortal
      && input.contractualChargeCalculatedByFinance,
    portalCalculatesCancellationCharge: false
  };
}

export function institutionalReportMayRun(input: {
  readonly tenantRoleAndPurposeScoped: boolean;
  readonly includesRawSafetyEvidence: boolean;
  readonly includesDiagnosisOrMedicalDetail: boolean;
  readonly includesDriverPrivateData: boolean;
  readonly includesUnrelatedPassengerHistory: boolean;
  readonly provenanceFieldsIncluded: boolean;
}): boolean {
  return input.tenantRoleAndPurposeScoped && input.provenanceFieldsIncluded
    && !input.includesRawSafetyEvidence && !input.includesDiagnosisOrMedicalDetail
    && !input.includesDriverPrivateData && !input.includesUnrelatedPassengerHistory;
}

export function evaluatePassengerMembershipEnd(input: {
  readonly actorReasonAndEffectiveTimeRecorded: boolean;
  readonly futureBookingDispositionRecorded: boolean;
  readonly passengerIdentityDeleted: boolean;
  readonly otherOrganisationRelationshipDeleted: boolean;
  readonly historicalBookingsRewritten: boolean;
  readonly historicalAccessNarrowedByPolicy: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly futureAuthorityRevoked: boolean } {
  const blockers: string[] = [];
  if (!input.actorReasonAndEffectiveTimeRecorded) blockers.push('MEMBERSHIP_END_PROVENANCE_REQUIRED');
  if (!input.futureBookingDispositionRecorded) blockers.push('FUTURE_BOOKING_DISPOSITION_REQUIRED');
  if (input.passengerIdentityDeleted) blockers.push('PASSENGER_IDENTITY_DELETION_PROHIBITED');
  if (input.otherOrganisationRelationshipDeleted) blockers.push('UNRELATED_RELATIONSHIP_DELETION_PROHIBITED');
  if (input.historicalBookingsRewritten) blockers.push('HISTORICAL_BOOKING_REWRITE_PROHIBITED');
  if (!input.historicalAccessNarrowedByPolicy) blockers.push('POST_RELATIONSHIP_ACCESS_POLICY_REQUIRED');
  return { allowed: blockers.length === 0, blockers, futureAuthorityRevoked: blockers.length === 0 };
}

export function institutionalTransportAcceptanceScenarioMayPass(input: {
  readonly scenario: InstitutionalTransportAcceptanceScenario;
  readonly canonicalBookingPerOccurrence: boolean;
  readonly tenantIsolationPreserved: boolean;
  readonly passengerIdentityIndependent: boolean;
  readonly authorityAndFundingIndependentlyChecked: boolean;
  readonly accessibilitySafeguardingPersisted: boolean;
  readonly historyAndProvenancePreserved: boolean;
  readonly rowLevelOrOccurrenceLevelOutcomeVisible: boolean;
  readonly organisationPortalMutatedJourneyOrFinanceDirectly: boolean;
}): boolean {
  return input.canonicalBookingPerOccurrence && input.tenantIsolationPreserved
    && input.passengerIdentityIndependent && input.authorityAndFundingIndependentlyChecked
    && input.accessibilitySafeguardingPersisted && input.historyAndProvenancePreserved
    && input.rowLevelOrOccurrenceLevelOutcomeVisible
    && !input.organisationPortalMutatedJourneyOrFinanceDirectly;
}

export const ROSTER_OWNS_PASSENGER_IDENTITY = false as const;
export const TEMPLATE_IS_CANONICAL_BOOKING = false as const;
export const TEMPLATE_RESERVES_DRIVER = false as const;
export const TEMPLATE_CREATES_FINANCE_LIABILITY = false as const;
export const CROSS_TENANT_DUPLICATE_RELATIONSHIP_DISCLOSURE_ALLOWED = false as const;
export const ORGANISATION_PORTAL_MAY_RELABEL_ACTIVE_JOURNEY_PASSENGER = false as const;
export const PASSENGER_NOT_READY_IS_AUTOMATIC_NO_SHOW = false as const;
export const FAMILIARITY_OVERRIDES_DRIVER_ELIGIBILITY = false as const;
export const INSTITUTIONAL_CANCELLATION_CHARGE_OWNED_BY_PORTAL = false as const;
export const INSTITUTIONAL_ENDPOINT_WRITES_JOURNEY_OR_PAYMENT = false as const;
export const INSTITUTIONAL_TRANSPORT_MUTATIONS_ENABLED = false as const;
