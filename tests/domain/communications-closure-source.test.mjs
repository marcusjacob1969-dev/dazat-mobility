import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.endsWith('.ts')) {
      const sourceUrl = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(sourceUrl))) return { url: sourceUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});

const {
  COMMUNICATION_ACCEPTANCE_SCENARIOS,
  COMMUNICATION_CONCEPTUAL_API_OPERATIONS,
  COMMUNICATION_LAUNCH_GATES,
  COMMUNICATION_P0_REQUIREMENTS,
  COMMUNICATIONS_CLOSURE_MUTATIONS_ENABLED,
  COMMUNICATIONS_MAY_INVENT_BUSINESS_STATE,
  COMMUNICATIONS_PRODUCTION_EXECUTION_ENABLED,
  COMMUNICATION_CONTENT_BROADLY_INDEXED_FOR_DASHBOARDS,
  CONTACT_VERIFICATION_GRANTS_UNLIMITED_AUTHORITY,
  ENDPOINT_CALL_GRANTS_DOMAIN_AUTHORITY,
  CRITICAL_COMMUNICATION_EVENT_TYPES,
  UNMANAGED_PROVIDER_BYPASS_ALLOWED,
  VOICE_AI_HIGH_RISK_DECISION_ALLOWED,
  communicationsAcceptanceScenarioMayPass,
  decideCommunicationsClosureRoute,
  decideCommunicationsDegradedMode,
  evaluateCanonicalCommunicationRequest,
  evaluateCommunicationEventEnvelope,
  evaluateCommunicationsLaunchReadiness,
  evaluateRecipientPermissionScope
} = await import('../../packages/domain/src/communications-closure.ts');

function canonicalRequest(overrides = {}) {
  return {
    communicationRequestId: 'request-1',
    idempotencyKey: 'booking-1-driver-assigned-rider',
    sourceDomain: 'BOOKING',
    sourceEventId: 'event-1',
    sourceEventRecorded: true,
    purpose: 'BOOKING_OPERATIONAL',
    priority: 'P1',
    recipientRole: 'PASSENGER',
    recipientRef: 'person-1',
    recipientPermissionResolved: true,
    templateId: 'driver-assigned',
    templateVersion: 2,
    criticalTemplateApproved: true,
    approvedPayloadVariableNames: ['driver_display_name', 'vehicle_registration', 'eta'],
    payloadContainsArbitrarySourceObject: false,
    stateVersion: 4,
    currentStateVersion: 4,
    timeSensitive: true,
    classification: 'CONFIDENTIAL',
    acknowledgementPolicyDefined: true,
    fallbackPolicyVersionRef: 'active-journey-v2',
    correlationId: 'correlation-1',
    ...overrides
  };
}

function envelope(overrides = {}) {
  return {
    eventId: 'event-1', eventType: 'DriverAssigned.v1', duplicateEvent: false,
    aggregateType: 'Booking', aggregateId: 'booking-1', aggregateVersion: 4,
    occurredAtRecorded: true, recordedAtRecorded: true, region: 'GB-MAN',
    serviceContext: 'STANDARD', classification: 'CONFIDENTIAL',
    correlationId: 'correlation-1', causationId: 'command-1',
    payloadSchemaVersionSupported: true, ...overrides
  };
}

function permission(overrides = {}) {
  return {
    role: 'PASSENGER', roleSpecificAuthorityPresent: true, activeTaskPresent: false,
    minimumNecessaryPayload: true, containsPayerOnlyFinancialData: false,
    containsPrivateSupportOrSafetyData: false, containsInternalCaseNotes: false,
    containsUnnecessaryMedicalDiagnosis: false, containsUnrelatedChildRecords: false,
    containsWholeBookingHistory: false, ...overrides
  };
}

function routeInput(overrides = {}) {
  return {
    sourceCurrent: true, recipientPermissionResolved: true,
    purposeAndClassificationResolved: true, validPurposeEligibleContactPointExists: true,
    accessibilityLanguageQuietHoursResolved: true, unsafeChannelsExcluded: true,
    activeNotificationAndFallbackPolicy: true, primaryAttempted: false,
    deliveryState: 'NOT_ATTEMPTED', acknowledgementRequired: true,
    fallbackPolicyAllows: true, fallbackAvailable: true,
    fallbackSourceRevalidated: true, critical: true, attemptCount: 0, attemptCap: 3,
    operatorOrIncidentPlanTookControl: false, ...overrides
  };
}

function scenario(overrides = {}) {
  return {
    scenario: 'NORMAL_APP_BOOKING', fixtureOnly: true, contactedRealUser: false,
    externalProviderCalled: false, authoritativeStateRevalidated: true,
    recipientPermissionsRespected: true, staleOrDuplicateMessageReleased: false,
    silentAssistanceAutoCalledReporter: false, paymentUnknownAskedBlindRetry: false,
    safeguardingUsedOrdinaryNoShow: false, lowConfidenceVoiceGuessedCommand: false,
    staffSnoopingDeniedOrBreakGlassAudited: true, nonSmartphonePathSucceeded: true,
    rideCheckMismatchBlockedJourneyStart: true, breakdownPassengerContinuityPreserved: true,
    highRiskSecurityStepUpApplied: true, independentSecurityWarningAttempted: true,
    accountRecoveredSolelyFromPhonePossession: false, lowConfidenceVoiceHandedOff: true,
    criticalFallbackPrioritizedOverMarketing: true,
    protectedContactRestrictedWithoutBlockingSafetySupport: true,
    evidenceReferencePresent: true,
    ...overrides
  };
}

test('canonical request needs source event, purpose, recipient authority and idempotency', () => {
  const result = evaluateCanonicalCommunicationRequest(canonicalRequest({
    idempotencyKey: '', sourceEventRecorded: false, purpose: '', recipientPermissionResolved: false
  }));
  assert.equal(result.accepted, false);
  assert.ok(result.blockers.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(result.blockers.includes('IMMUTABLE_SOURCE_EVENT_REQUIRED'));
  assert.ok(result.blockers.includes('RECIPIENT_PERMISSION_REQUIRED'));
  assert.equal(result.priorityGrantsAdditionalDataAccess, false);
});

test('canonical request stores approved variables rather than a source-object dump', () => {
  const result = evaluateCanonicalCommunicationRequest(canonicalRequest({ payloadContainsArbitrarySourceObject: true }));
  assert.equal(result.accepted, false);
  assert.ok(result.blockers.includes('ARBITRARY_SOURCE_OBJECT_DUMP_PROHIBITED'));
  assert.equal(result.arbitrarySourceObjectStored, false);
});

test('critical requests need an approved template version', () => {
  const result = evaluateCanonicalCommunicationRequest(canonicalRequest({ criticalTemplateApproved: false }));
  assert.equal(result.accepted, false);
  assert.ok(result.blockers.includes('CRITICAL_TEMPLATE_APPROVAL_REQUIRED'));
});

test('time-sensitive request suppresses stale authoritative state', () => {
  const result = evaluateCanonicalCommunicationRequest(canonicalRequest({ stateVersion: 3 }));
  assert.equal(result.staleSuppressed, true);
  assert.ok(result.blockers.includes('STALE_AUTHORITATIVE_STATE_SUPPRESSED'));
});

test('valid canonical request preserves communication ownership boundary', () => {
  const result = evaluateCanonicalCommunicationRequest(canonicalRequest());
  assert.equal(result.accepted, true);
  assert.equal(result.rawContactAcceptedFromSourceDomain, false);
  assert.equal(result.businessStateInventedByCommunications, false);
});

test('event envelope requires versioned event type and supported payload schema', () => {
  const result = evaluateCommunicationEventEnvelope(envelope({ eventType: 'DriverAssigned', payloadSchemaVersionSupported: false }));
  assert.equal(result.accepted, false);
  assert.ok(result.blockers.includes('VERSIONED_EVENT_TYPE_REQUIRED'));
  assert.ok(result.blockers.includes('UNSUPPORTED_PAYLOAD_SCHEMA'));
  assert.equal(result.unsupportedCriticalSchemaFailsClosed, true);
});

test('duplicate immutable event is deduplicated at ingestion', () => {
  const result = evaluateCommunicationEventEnvelope(envelope({ duplicateEvent: true }));
  assert.equal(result.accepted, false);
  assert.equal(result.deduplicated, true);
  assert.ok(result.blockers.includes('DUPLICATE_EVENT_DEDUPLICATED'));
});

test('passenger does not inherit payer-only financial visibility', () => {
  const result = evaluateRecipientPermissionScope(permission({ containsPayerOnlyFinancialData: true }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('PAYER_ONLY_FINANCE_EXCLUDED'));
  assert.equal(result.unrestrictedRelationshipVisibilityGranted, false);
});

test('driver receives only minimum operational data, not diagnosis or history', () => {
  const result = evaluateRecipientPermissionScope(permission({
    role: 'DRIVER', containsUnnecessaryMedicalDiagnosis: true, containsWholeBookingHistory: true
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('DRIVER_MINIMUM_OPERATIONAL_SCOPE_EXCEEDED'));
});

test('booker, guardian, Safety and organisation roles do not inherit unrelated financial or child scope', () => {
  assert.ok(evaluateRecipientPermissionScope(permission({
    role: 'BOOKER', containsPayerOnlyFinancialData: true
  })).blockers.includes('BOOKER_PAYER_SCOPE_EXCEEDED'));
  assert.ok(evaluateRecipientPermissionScope(permission({
    role: 'GUARDIAN_CARER', containsWholeBookingHistory: true
  })).blockers.includes('GUARDIAN_CARER_SCOPE_EXCEEDED'));
  assert.ok(evaluateRecipientPermissionScope(permission({
    role: 'SAFETY_OPERATOR', containsPayerOnlyFinancialData: true
  })).blockers.includes('SAFETY_SCOPE_EXCEEDED'));
  assert.ok(evaluateRecipientPermissionScope(permission({
    role: 'BUSINESS_AUTHORITY_CONTACT', containsUnrelatedChildRecords: true
  })).blockers.includes('BUSINESS_AUTHORITY_SCOPE_EXCEEDED'));
});

test('Control Room access requires an active task', () => {
  const result = evaluateRecipientPermissionScope(permission({ role: 'CONTROL_ROOM_OPERATOR', activeTaskPresent: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('ACTIVE_OPERATOR_TASK_REQUIRED'));
});

test('closure route suppresses stale state before any channel decision', () => {
  const result = decideCommunicationsClosureRoute(routeInput({ sourceCurrent: false }));
  assert.equal(result.action, 'SUPPRESS_STALE');
  assert.equal(result.completedDecisionSteps, 1);
  assert.equal(result.staleFallbackAllowed, false);
});

test('closure route attempts primary only after the first six decisions pass', () => {
  const result = decideCommunicationsClosureRoute(routeInput());
  assert.equal(result.action, 'ATTEMPT_PRIMARY');
  assert.equal(result.completedDecisionSteps, 7);
});

test('SENT does not complete the delivery route', () => {
  const result = decideCommunicationsClosureRoute(routeInput({
    primaryAttempted: true, deliveryState: 'SENT', attemptCount: 1
  }));
  assert.equal(result.action, 'WAIT_FOR_DELIVERY_OR_ACKNOWLEDGEMENT');
  assert.equal(result.sentTreatedAsDelivered, false);
  assert.equal(result.providerAcceptanceTreatedAsDelivery, false);
});

test('DELIVERED and READ wait when policy requires recipient acknowledgement', () => {
  const delivered = decideCommunicationsClosureRoute(routeInput({
    primaryAttempted: true, deliveryState: 'DELIVERED', attemptCount: 1, acknowledgementRequired: true
  }));
  assert.equal(delivered.action, 'WAIT_FOR_DELIVERY_OR_ACKNOWLEDGEMENT');
  const read = decideCommunicationsClosureRoute(routeInput({
    primaryAttempted: true, deliveryState: 'READ', attemptCount: 1, acknowledgementRequired: true
  }));
  assert.equal(read.action, 'WAIT_FOR_DELIVERY_OR_ACKNOWLEDGEMENT');
});

test('delivery completes without acknowledgement only when policy does not require it', () => {
  const result = decideCommunicationsClosureRoute(routeInput({
    primaryAttempted: true, deliveryState: 'DELIVERED', attemptCount: 1, acknowledgementRequired: false
  }));
  assert.equal(result.action, 'COMPLETE');
});

test('failed current primary can use governed revalidated fallback', () => {
  const result = decideCommunicationsClosureRoute(routeInput({
    primaryAttempted: true, deliveryState: 'FAILED', attemptCount: 1
  }));
  assert.equal(result.action, 'ATTEMPT_FALLBACK');
});

test('critical failure opens an operational case when fallback is unavailable', () => {
  const result = decideCommunicationsClosureRoute(routeInput({
    primaryAttempted: true, deliveryState: 'UNKNOWN', fallbackAvailable: false, attemptCount: 1
  }));
  assert.equal(result.action, 'OPEN_COMMUNICATION_FAILURE_CASE');
});

test('Shield outage pauses risky changes but preserves essential canonical work', () => {
  const risky = decideCommunicationsDegradedMode({
    channelHealth: 'HEALTHY', classification: 'SECURITY', recoveryReplayRequested: false,
    sourceCurrent: true, duplicateEvent: false, shieldAvailable: false,
    highRiskAccountOrFinancialChange: true, essentialJourneySafetyOrSafeguarding: false,
    approvedSafeAlternateAvailable: false
  });
  assert.equal(risky.action, 'PAUSE_HIGH_RISK_CHANGE');
  assert.equal(risky.riskyChangeFailsOpen, false);
  const essential = decideCommunicationsDegradedMode({
    channelHealth: 'OUTAGE', classification: 'SAFETY_CRITICAL', recoveryReplayRequested: false,
    sourceCurrent: true, duplicateEvent: false, shieldAvailable: false,
    highRiskAccountOrFinancialChange: false, essentialJourneySafetyOrSafeguarding: true,
    approvedSafeAlternateAvailable: false
  });
  assert.equal(essential.action, 'CONTINUE_ESSENTIAL_CANONICAL');
  assert.equal(essential.activeJourneyStrandedByShieldOutage, false);
});

test('recovery discards stale and duplicate events before release', () => {
  const stale = decideCommunicationsDegradedMode({
    channelHealth: 'RECOVERING', classification: 'ACTIVE_JOURNEY', recoveryReplayRequested: true,
    sourceCurrent: false, duplicateEvent: false, shieldAvailable: true,
    highRiskAccountOrFinancialChange: false, essentialJourneySafetyOrSafeguarding: true,
    approvedSafeAlternateAvailable: true
  });
  assert.equal(stale.action, 'DISCARD_STALE');
  const duplicate = decideCommunicationsDegradedMode({
    channelHealth: 'RECOVERING', classification: 'ACTIVE_JOURNEY', recoveryReplayRequested: true,
    sourceCurrent: true, duplicateEvent: true, shieldAvailable: true,
    highRiskAccountOrFinancialChange: false, essentialJourneySafetyOrSafeguarding: true,
    approvedSafeAlternateAvailable: true
  });
  assert.equal(duplicate.action, 'DISCARD_DUPLICATE');
});

test('acceptance catalogue contains every blueprint closure scenario', () => {
  assert.equal(COMMUNICATION_ACCEPTANCE_SCENARIOS.length, 18);
  assert.ok(COMMUNICATION_ACCEPTANCE_SCENARIOS.includes('LANDLINE_ONLY_PASSENGER'));
  assert.ok(COMMUNICATION_ACCEPTANCE_SCENARIOS.includes('STAFF_SNOOPING'));
});

test('critical events, conceptual APIs and P0 requirement IDs are complete catalogues', () => {
  assert.equal(CRITICAL_COMMUNICATION_EVENT_TYPES.length, 14);
  assert.ok(CRITICAL_COMMUNICATION_EVENT_TYPES.includes('SilentAssistance.v1'));
  assert.ok(CRITICAL_COMMUNICATION_EVENT_TYPES.includes('CommunicationsChannelOutage.v1'));
  assert.equal(COMMUNICATION_CONCEPTUAL_API_OPERATIONS.length, 15);
  assert.ok(COMMUNICATION_CONCEPTUAL_API_OPERATIONS.includes('POST /communications/security/restrict-channel'));
  assert.equal(COMMUNICATION_P0_REQUIREMENTS.length, 20);
  assert.ok(COMMUNICATION_P0_REQUIREMENTS.includes('COM-SAF-001'));
  assert.ok(COMMUNICATION_P0_REQUIREMENTS.includes('COM-ACC-001'));
});

test('acceptance scenarios use fixtures and never contact people or providers', () => {
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario()), true);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({ contactedRealUser: true })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({ externalProviderCalled: true })), false);
});

test('scenario-specific safety, payment, safeguarding, voice and snooping rules fail closed', () => {
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'SILENT_ASSISTANCE', silentAssistanceAutoCalledReporter: true
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'PAYMENT_STATUS_UNKNOWN', paymentUnknownAskedBlindRetry: true
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'SCHOOL_HANDOVER_FAILURE', safeguardingUsedOrdinaryNoShow: true
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'TELEPHONY_AI_LOW_CONFIDENCE', lowConfidenceVoiceGuessedCommand: true
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'STAFF_SNOOPING', staffSnoopingDeniedOrBreakGlassAudited: false
  })), false);
});

test('accessibility, RideCheck, breakdown and contact-abuse acceptance criteria fail closed', () => {
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'LANDLINE_ONLY_PASSENGER', nonSmartphonePathSucceeded: false
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'RIDECHECK_MISMATCH', rideCheckMismatchBlockedJourneyStart: false
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'PASSENGER_ONBOARD_BREAKDOWN', breakdownPassengerContinuityPreserved: false
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'CONTACT_ABUSE', protectedContactRestrictedWithoutBlockingSafetySupport: false
  })), false);
});

test('takeover, SIM-swap and outage acceptance criteria fail closed', () => {
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'PAYOUT_BANK_TAKEOVER', independentSecurityWarningAttempted: false
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'SIM_SWAP_OTP_FLOOD', accountRecoveredSolelyFromPhonePossession: true
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'SMS_OUTAGE', criticalFallbackPrioritizedOverMarketing: false
  })), false);
  assert.equal(communicationsAcceptanceScenarioMayPass(scenario({
    scenario: 'TELEPHONY_AI_LOW_CONFIDENCE', lowConfidenceVoiceHandedOff: false
  })), false);
});

test('all thirteen launch gates plus accountable approvals are required', () => {
  const pass = Object.fromEntries(COMMUNICATION_LAUNCH_GATES.map((gate) => [gate, 'PASS']));
  const result = evaluateCommunicationsLaunchReadiness({
    evidence: pass, productionPoliciesApproved: true, providerSelectedAndContracted: true,
    operationsStaffingApproved: true, privacyRetentionApproved: true
  });
  assert.equal(COMMUNICATION_LAUNCH_GATES.length, 13);
  assert.equal(result.evidenceComplete, true);
  assert.equal(result.pilotReadyRecommendation, true);
  assert.equal(result.providerExecutionMayBeEnabledAtThisCheckpoint, false);
});

test('one untested launch gate prevents a readiness recommendation', () => {
  const evidence = Object.fromEntries(COMMUNICATION_LAUNCH_GATES.map((gate) => [gate, 'PASS']));
  evidence.OUTAGE_AND_ABUSE_RUNBOOKS_READY = 'NOT_TESTED';
  const result = evaluateCommunicationsLaunchReadiness({
    evidence, productionPoliciesApproved: true, providerSelectedAndContracted: true,
    operationsStaffingApproved: true, privacyRetentionApproved: true
  });
  assert.equal(result.evidenceComplete, false);
  assert.equal(result.pilotReadyRecommendation, false);
  assert.deepEqual(result.unmetGates, ['OUTAGE_AND_ABUSE_RUNBOOKS_READY']);
});

test('communications closure hard boundaries stay disabled', () => {
  assert.equal(COMMUNICATIONS_MAY_INVENT_BUSINESS_STATE, false);
  assert.equal(ENDPOINT_CALL_GRANTS_DOMAIN_AUTHORITY, false);
  assert.equal(UNMANAGED_PROVIDER_BYPASS_ALLOWED, false);
  assert.equal(VOICE_AI_HIGH_RISK_DECISION_ALLOWED, false);
  assert.equal(COMMUNICATIONS_PRODUCTION_EXECUTION_ENABLED, false);
  assert.equal(COMMUNICATIONS_CLOSURE_MUTATIONS_ENABLED, false);
  assert.equal(COMMUNICATION_CONTENT_BROADLY_INDEXED_FOR_DASHBOARDS, false);
  assert.equal(CONTACT_VERIFICATION_GRANTS_UNLIMITED_AUTHORITY, false);
});
