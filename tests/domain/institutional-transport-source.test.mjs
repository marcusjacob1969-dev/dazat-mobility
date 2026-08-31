import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_SERIES_CHANGE_SCOPES,
  BULK_PASSENGER_IMPORT_STATES,
  CROSS_TENANT_DUPLICATE_RELATIONSHIP_DISCLOSURE_ALLOWED,
  evaluateBookingOccurrenceGeneration,
  evaluateBookingSeriesAmendment,
  evaluateInstitutionalBookingAuthority,
  evaluateInstitutionalBulkCommit,
  evaluateInstitutionalCancellation,
  evaluateInstitutionalPassengerSubstitution,
  evaluateInstitutionalServiceEligibility,
  evaluateManagedPassengerRelationship,
  evaluatePassengerMembershipEnd,
  evaluatePassengerReadiness,
  evaluateScheduledInstitutionalCapacity,
  evaluateSchoolInstitutionalSchedule,
  FAMILIARITY_OVERRIDES_DRIVER_ELIGIBILITY,
  INSTITUTIONAL_CANCELLATION_CHARGE_OWNED_BY_PORTAL,
  INSTITUTIONAL_CANCELLATION_REASONS,
  INSTITUTIONAL_ENDPOINT_WRITES_JOURNEY_OR_PAYMENT,
  INSTITUTIONAL_SERVICE_TYPES,
  INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS,
  INSTITUTIONAL_TRANSPORT_API_PATHS,
  INSTITUTIONAL_TRANSPORT_COMMANDS,
  INSTITUTIONAL_TRANSPORT_EVENTS,
  INSTITUTIONAL_TRANSPORT_MUTATIONS_ENABLED,
  INSTITUTIONAL_TRANSPORT_P0_REQUIREMENTS,
  institutionalReportMayRun,
  institutionalTransportAcceptanceScenarioMayPass,
  ORGANISATION_PASSENGER_MEMBERSHIP_STATES,
  ORGANISATION_PORTAL_MAY_RELABEL_ACTIVE_JOURNEY_PASSENGER,
  ORGANISATION_TRANSPORT_EXCEPTION_TYPES,
  PASSENGER_NOT_READY_IS_AUTOMATIC_NO_SHOW,
  ROSTER_OWNS_PASSENGER_IDENTITY,
  TEMPLATE_CREATES_FINANCE_LIABILITY,
  TEMPLATE_IS_CANONICAL_BOOKING,
  TEMPLATE_RESERVES_DRIVER
} from '../../packages/domain/src/institutional-transport.ts';

const validRelationship = {
  organisationId: 'org-a', relationshipOrganisationId: 'org-a', passengerIdentityExistsIndependently: true,
  organisationClaimsPassengerOwnership: false, localReferenceExposedAsGlobalIdentity: false,
  otherOrganisationRelationshipsDisclosed: false, purposeAndAuthorityBasisRecorded: true,
  minimumTransportDataOnly: true, diagnosisStoredByDefault: false
};

test('managed passenger is a tenant relationship, never organisation-owned identity', () => {
  const result = evaluateManagedPassengerRelationship(validRelationship);
  assert.equal(result.allowed, true);
  assert.equal(result.passengerIdentityOwnedByOrganisation, false);
});

test('cross-tenant passenger relationship disclosure fails closed', () => {
  const result = evaluateManagedPassengerRelationship({ ...validRelationship, otherOrganisationRelationshipsDisclosed: true });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('CROSS_TENANT_PASSENGER_RELATIONSHIP_DISCLOSURE'));
});

test('hospital and care profiles default to minimum transport data, not diagnoses', () => {
  const result = evaluateManagedPassengerRelationship({ ...validRelationship, diagnosisStoredByDefault: true });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('TRANSPORT_DATA_MINIMISATION_REQUIRED'));
});

const bookingAuthority = {
  membershipActiveAndCurrent: true, bookingAuthorityActive: true, passengerWithinAuthorityScope: true,
  fundingRequired: true, fundingAuthorisationActive: true, fundingScopeMatches: true,
  serviceEligibilityCurrent: true, organisationAgreementCurrent: true, requestedPersonalPassengerFallback: false
};

test('booking and funding authority are independently satisfied before canonical Booking', () => {
  const result = evaluateInstitutionalBookingAuthority(bookingAuthority);
  assert.equal(result.action, 'CREATE_CANONICAL_BOOKING');
  assert.equal(result.passengerPersonalLiabilityCreated, false);
});

test('expired funding opens an exception instead of charging passenger personally', () => {
  const result = evaluateInstitutionalBookingAuthority({ ...bookingAuthority, fundingAuthorisationActive: false });
  assert.equal(result.action, 'OPEN_FUNDING_OR_APPROVAL_EXCEPTION');
  assert.ok(result.blockers.includes('FUNDING_AUTHORISATION_REQUIRED'));
});

test('personal passenger liability fallback is prohibited', () => {
  const result = evaluateInstitutionalBookingAuthority({ ...bookingAuthority, requestedPersonalPassengerFallback: true });
  assert.equal(result.action, 'DENY');
  assert.equal(result.passengerPersonalLiabilityCreated, false);
});

const eligibleService = {
  requestedServiceType: 'WAV', passengerRequirementsSatisfied: true,
  organisationAgreementAllowsService: true, regionAndTimeAllowed: true,
  driverPermissionCurrent: true, vehicleCapabilityCurrent: true,
  requiredAccessibilityPreserved: true, safeguardingAndHandoverPreserved: true,
  evaluationStage: 'DISPATCH'
};

test('service eligibility is re-evaluated with current driver and vehicle capability', () => {
  assert.equal(evaluateInstitutionalServiceEligibility(eligibleService).eligible, true);
  assert.equal(evaluateInstitutionalServiceEligibility({ ...eligibleService, driverPermissionCurrent: false }).exception, 'NO_ELIGIBLE_DRIVER');
});

test('cheaper organisation policy cannot downgrade a WAV requirement', () => {
  const result = evaluateInstitutionalServiceEligibility({ ...eligibleService, requiredAccessibilityPreserved: false });
  assert.equal(result.eligible, false);
  assert.equal(result.exception, 'NO_ELIGIBLE_SERVICE');
  assert.equal(result.requirementsDowngraded, false);
});

const validGeneration = {
  templateActiveAndCurrent: true, recurrenceStructured: true, calendarVersionRecorded: true,
  generationHorizonAllowed: true, requestedOccurrenceCount: 10, uniqueCanonicalBookingCount: 10,
  templateVersionStoredOnEveryOccurrence: true, agreementAndPolicyVersionsStored: true,
  driverReservedByTemplate: false, financeLiabilityCreatedByTemplate: false
};

test('ten recurring occurrences create ten independently auditable canonical Bookings', () => {
  const result = evaluateBookingOccurrenceGeneration(validGeneration);
  assert.equal(result.allowed, true);
  assert.equal(result.templateIsCanonicalBooking, false);
});

test('template cannot reserve a driver or create finance liability', () => {
  const result = evaluateBookingOccurrenceGeneration({ ...validGeneration, driverReservedByTemplate: true, financeLiabilityCreatedByTemplate: true });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockers.slice(-2), ['TEMPLATE_CANNOT_RESERVE_DRIVER', 'TEMPLATE_CANNOT_CREATE_FINANCE_LIABILITY']);
});

test('generation horizon and structured calendar fail closed', () => {
  const result = evaluateBookingOccurrenceGeneration({ ...validGeneration, recurrenceStructured: false, generationHorizonAllowed: false });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('STRUCTURED_RECURRENCE_REQUIRED'));
  assert.ok(result.blockers.includes('GENERATION_HORIZON_EXCEEDED'));
});

const validSeriesChange = {
  scope: 'THIS_OCCURRENCE_ONLY', scopePermitted: true, completedBookingsChanged: false,
  activeJourneyChangedThroughSeries: false, futureOccurrencesUseNewTemplateVersion: false,
  unaffectedOccurrencesPreserved: true, passengerRequirementsPreserved: true,
  fundingRevalidatedWhenMaterial: true
};

test('single occurrence amendment leaves future occurrences unchanged', () => {
  assert.equal(evaluateBookingSeriesAmendment(validSeriesChange).allowed, true);
});

test('this-and-future change requires a new template version', () => {
  const result = evaluateBookingSeriesAmendment({ ...validSeriesChange, scope: 'THIS_AND_FUTURE_OCCURRENCES' });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('NEW_TEMPLATE_VERSION_REQUIRED'));
});

test('series edit cannot mutate completed Booking or active Journey', () => {
  const result = evaluateBookingSeriesAmendment({ ...validSeriesChange, completedBookingsChanged: true, activeJourneyChangedThroughSeries: true });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('COMPLETED_BOOKING_IMMUTABLE'));
  assert.ok(result.blockers.includes('ACTIVE_JOURNEY_REQUIRES_CANONICAL_AMENDMENT'));
});

const validSchool = {
  structuredTermCalendar: true, closureAndExceptionDatesApplied: true,
  preferredDriverEligibleNow: true, selectedDriverEligibleNow: true, selectedVehicleEligibleNow: true,
  accessibilityRequirementsPreserved: true, handoverRulesPreservedPerOccurrence: true,
  familiarityUsedOnlyAsRankingPreference: true
};

test('school recurrence preserves calendar, eligibility, accessibility and handover', () => {
  assert.equal(evaluateSchoolInstitutionalSchedule(validSchool).allowed, true);
});

test('ineligible familiar driver cannot override hard eligibility', () => {
  const result = evaluateSchoolInstitutionalSchedule({ ...validSchool, preferredDriverEligibleNow: false });
  assert.equal(result.allowed, true);
  assert.equal(result.preferredDriverMayBeUsed, false);
});

test('selected ineligible school vehicle fails closed', () => {
  const result = evaluateSchoolInstitutionalSchedule({ ...validSchool, selectedVehicleEligibleNow: false });
  assert.equal(result.allowed, false);
});

const validCapacity = {
  requiredCapability: 'WAV', reservedCapability: 'WAV', activeAssignmentsChecked: true,
  earlierScheduledWorkChecked: true, travelTimeChecked: true, maintenanceChecked: true,
  fatigueAndRestChecked: true, serviceCommitmentsChecked: true, scheduleConflictPresent: false
};

test('scheduled capacity is capability-aware and conflict checked', () => {
  assert.equal(evaluateScheduledInstitutionalCapacity(validCapacity).allowed, true);
});

test('ordinary cars do not satisfy WAV capacity', () => {
  const result = evaluateScheduledInstitutionalCapacity({ ...validCapacity, reservedCapability: 'STANDARD' });
  assert.equal(result.allowed, false);
  assert.equal(result.rowAttachmentProvesCapacity, false);
});

test('passenger not ready can wait without becoming no-show', () => {
  const result = evaluatePassengerReadiness({
    readiness: 'NOT_READY', authoritativeStateCurrent: true, withinScheduledPickupWindow: true,
    servicePolicyAllowsWaiting: true, automaticallyRecordedNoShow: false,
    guaranteedInstantCollectionClaimed: false
  });
  assert.equal(result.action, 'WAIT');
  assert.equal(result.passengerNoShowRecorded, false);
});

test('later current READY state releases to scheduling', () => {
  const result = evaluatePassengerReadiness({
    readiness: 'READY', authoritativeStateCurrent: true, withinScheduledPickupWindow: true,
    servicePolicyAllowsWaiting: true, automaticallyRecordedNoShow: false,
    guaranteedInstantCollectionClaimed: false
  });
  assert.equal(result.action, 'RELEASE_TO_SCHEDULING');
});

const validBulk = {
  dryRunCompleted: true, everyRowHasVisibleOutcome: true, duplicateDetectionCompleted: true,
  crossTenantRelationshipDisclosed: false, idempotencyKeyPresent: true, replayedCommit: false,
  policyAllowsPartialCommit: false, partialCommitRequested: false, malformedRowSilentlyIgnored: false
};

test('bulk commit requires dry run, row outcomes, duplicate checks and idempotency', () => {
  assert.equal(evaluateInstitutionalBulkCommit(validBulk).allowed, true);
});

test('bulk duplicate detection cannot disclose another tenant relationship', () => {
  const result = evaluateInstitutionalBulkCommit({ ...validBulk, crossTenantRelationshipDisclosed: true });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('CROSS_TENANT_DUPLICATE_DISCLOSURE_PROHIBITED'));
});

test('bulk replay is deduplicated and partial result cannot be ambiguous', () => {
  const replay = evaluateInstitutionalBulkCommit({ ...validBulk, replayedCommit: true });
  assert.equal(replay.deduplicated, true);
  const partial = evaluateInstitutionalBulkCommit({ ...validBulk, malformedRowSilentlyIgnored: true });
  assert.ok(partial.blockers.includes('AMBIGUOUS_PARTIAL_RESULT_PROHIBITED'));
});

test('future passenger substitution revalidates every authority and requirement', () => {
  const result = evaluateInstitutionalPassengerSubstitution({
    activeJourney: false, authorisedPassengerRelationship: true, serviceEligibilityRevalidated: true,
    requirementsRevalidated: true, fundingRevalidated: true, communicationsRevalidated: true,
    rideCheckAndBookingPartyRulesApplied: true
  });
  assert.equal(result.allowed, true);
  assert.equal(result.canonicalWorkflowRequired, true);
});

test('organisation portal cannot relabel passenger on active Journey', () => {
  const result = evaluateInstitutionalPassengerSubstitution({
    activeJourney: true, authorisedPassengerRelationship: true, serviceEligibilityRevalidated: true,
    requirementsRevalidated: true, fundingRevalidated: true, communicationsRevalidated: true,
    rideCheckAndBookingPartyRulesApplied: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.canonicalWorkflowRequired, true);
});

test('institutional cancellation uses canonical state and Finance-owned charge', () => {
  const result = evaluateInstitutionalCancellation({
    reason: 'SCHOOL_CLOSED', canonicalBookingTransitionUsed: true,
    serviceSpecificNoShowPolicyUsed: true, passengerNotReadyMisclassifiedAsNoShow: false,
    activeJourneyCancelledThroughPortal: false, contractualChargeCalculatedByFinance: true
  });
  assert.equal(result.allowed, true);
  assert.equal(result.portalCalculatesCancellationCharge, false);
});

test('institutional report excludes raw Safety, diagnosis and unrelated history', () => {
  assert.equal(institutionalReportMayRun({
    tenantRoleAndPurposeScoped: true, includesRawSafetyEvidence: false,
    includesDiagnosisOrMedicalDetail: false, includesDriverPrivateData: false,
    includesUnrelatedPassengerHistory: false, provenanceFieldsIncluded: true
  }), true);
  assert.equal(institutionalReportMayRun({
    tenantRoleAndPurposeScoped: true, includesRawSafetyEvidence: false,
    includesDiagnosisOrMedicalDetail: true, includesDriverPrivateData: false,
    includesUnrelatedPassengerHistory: false, provenanceFieldsIncluded: true
  }), false);
});

test('roster end preserves passenger identity, other relationships and history', () => {
  const result = evaluatePassengerMembershipEnd({
    actorReasonAndEffectiveTimeRecorded: true, futureBookingDispositionRecorded: true,
    passengerIdentityDeleted: false, otherOrganisationRelationshipDeleted: false,
    historicalBookingsRewritten: false, historicalAccessNarrowedByPolicy: true
  });
  assert.equal(result.allowed, true);
  assert.equal(result.futureAuthorityRevoked, true);
});

test('Part 2 catalogues exactly match the blueprint counts', () => {
  assert.equal(ORGANISATION_PASSENGER_MEMBERSHIP_STATES.length, 5);
  assert.equal(INSTITUTIONAL_SERVICE_TYPES.length, 8);
  assert.equal(BOOKING_SERIES_CHANGE_SCOPES.length, 3);
  assert.equal(BULK_PASSENGER_IMPORT_STATES.length, 7);
  assert.equal(INSTITUTIONAL_CANCELLATION_REASONS.length, 7);
  assert.equal(ORGANISATION_TRANSPORT_EXCEPTION_TYPES.length, 9);
  assert.equal(INSTITUTIONAL_TRANSPORT_API_PATHS.length, 10);
  assert.equal(INSTITUTIONAL_TRANSPORT_COMMANDS.length, 15);
  assert.equal(INSTITUTIONAL_TRANSPORT_EVENTS.length, 18);
  assert.equal(INSTITUTIONAL_TRANSPORT_P0_REQUIREMENTS.length, 19);
  assert.equal(INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS.length, 18);
});

test('every Part 2 acceptance scenario requires canonical tenant-safe provenance', () => {
  for (const scenario of INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS) {
    assert.equal(institutionalTransportAcceptanceScenarioMayPass({
      scenario, canonicalBookingPerOccurrence: true, tenantIsolationPreserved: true,
      passengerIdentityIndependent: true, authorityAndFundingIndependentlyChecked: true,
      accessibilitySafeguardingPersisted: true, historyAndProvenancePreserved: true,
      rowLevelOrOccurrenceLevelOutcomeVisible: true, organisationPortalMutatedJourneyOrFinanceDirectly: false
    }), true);
  }
});

test('Part 2 hard boundaries remain disabled', () => {
  assert.equal(ROSTER_OWNS_PASSENGER_IDENTITY, false);
  assert.equal(TEMPLATE_IS_CANONICAL_BOOKING, false);
  assert.equal(TEMPLATE_RESERVES_DRIVER, false);
  assert.equal(TEMPLATE_CREATES_FINANCE_LIABILITY, false);
  assert.equal(CROSS_TENANT_DUPLICATE_RELATIONSHIP_DISCLOSURE_ALLOWED, false);
  assert.equal(ORGANISATION_PORTAL_MAY_RELABEL_ACTIVE_JOURNEY_PASSENGER, false);
  assert.equal(PASSENGER_NOT_READY_IS_AUTOMATIC_NO_SHOW, false);
  assert.equal(FAMILIARITY_OVERRIDES_DRIVER_ELIGIBILITY, false);
  assert.equal(INSTITUTIONAL_CANCELLATION_CHARGE_OWNED_BY_PORTAL, false);
  assert.equal(INSTITUTIONAL_ENDPOINT_WRITES_JOURNEY_OR_PAYMENT, false);
  assert.equal(INSTITUTIONAL_TRANSPORT_MUTATIONS_ENABLED, false);
});
