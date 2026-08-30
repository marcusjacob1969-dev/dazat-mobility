import type { ChannelProviderHealthState, CommunicationPolicyClass } from './communications-operations.js';

export const COMMUNICATION_SOURCE_DOMAINS = [
  'BOOKING', 'JOURNEY', 'SAFETY', 'SCHOOL', 'FINANCE', 'DRIVER', 'FLEET',
  'SUPPORT', 'SHIELD', 'SYSTEM', 'BUSINESS'
] as const;
export type CommunicationSourceDomain = (typeof COMMUNICATION_SOURCE_DOMAINS)[number];

export const COMMUNICATION_RECIPIENT_ROLES = [
  'PASSENGER', 'BOOKER', 'PAYER', 'GUARDIAN_CARER', 'SCHOOL_CONTACT', 'DRIVER',
  'BUSINESS_AUTHORITY_CONTACT', 'CONTROL_ROOM_OPERATOR', 'SAFETY_OPERATOR', 'PARTNER_RESCUE_PROVIDER'
] as const;
export type CommunicationRecipientRole = (typeof COMMUNICATION_RECIPIENT_ROLES)[number];

export const COMMUNICATION_DATA_CLASSIFICATIONS = [
  'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGHLY_RESTRICTED'
] as const;
export type CommunicationDataClassification = (typeof COMMUNICATION_DATA_CLASSIFICATIONS)[number];

export const CRITICAL_COMMUNICATION_EVENT_TYPES = [
  'DriverAssigned.v1', 'DriverArrived.v1', 'RideCheckMismatch.v1',
  'PassengerOnboardBreakdown.v1', 'ReplacementDriverAssigned.v1', 'SafetySOS.v1',
  'SilentAssistance.v1', 'SchoolHandoverFailed.v1', 'PaymentStatusUnknown.v1',
  'PayoutDestinationChanged.v1', 'VehicleDoNotUse.v1', 'ContactPointChanged.v1',
  'AccountRecoveryStarted.v1', 'CommunicationsChannelOutage.v1'
] as const;
export type CriticalCommunicationEventType = (typeof CRITICAL_COMMUNICATION_EVENT_TYPES)[number];

export const COMMUNICATION_CONCEPTUAL_API_OPERATIONS = [
  'POST /communications', 'POST /communications/{id}/acknowledge',
  'GET /communications/{id}/status', 'GET/PUT /communication-preferences',
  'POST /contact-points/verify', 'POST /contact-points/change',
  'POST /conversations', 'POST /calls/masked', 'POST /telephone/sessions',
  'POST /voice/dialogues', 'POST /account-recovery',
  'POST /account-recovery/{id}/evidence', 'POST /account-recovery/{id}/complete',
  'POST /communications/security/restrict-channel', 'GET /communications/channel-health'
] as const;
export type CommunicationConceptualApiOperation = (typeof COMMUNICATION_CONCEPTUAL_API_OPERATIONS)[number];

export const COMMUNICATION_P0_REQUIREMENTS = [
  'COM-CORE-001', 'COM-CORE-002', 'COM-CORE-003',
  'COM-DEL-001', 'COM-DEL-002', 'COM-DEL-003',
  'COM-TEL-001', 'COM-TEL-002', 'COM-VOI-001',
  'COM-SEC-001', 'COM-SEC-002', 'COM-SEC-003',
  'COM-SAF-001', 'COM-SCH-001', 'COM-FIN-001',
  'COM-PRV-001', 'COM-PRV-002', 'COM-RES-001', 'COM-AUD-001', 'COM-ACC-001'
] as const;
export type CommunicationP0Requirement = (typeof COMMUNICATION_P0_REQUIREMENTS)[number];

export const COMMUNICATION_ACCEPTANCE_SCENARIOS = [
  'NORMAL_APP_BOOKING', 'THIRD_PARTY_BOOKING', 'LANDLINE_ONLY_PASSENGER',
  'DRIVER_REASSIGNMENT_RACE', 'RIDECHECK_MISMATCH', 'PASSENGER_ONBOARD_BREAKDOWN',
  'SILENT_ASSISTANCE', 'SCHOOL_HANDOVER_FAILURE', 'PAYMENT_STATUS_UNKNOWN',
  'PAYOUT_BANK_TAKEOVER', 'SIM_SWAP_OTP_FLOOD', 'TELEPHONY_AI_LOW_CONFIDENCE',
  'SMS_OUTAGE', 'OUTAGE_RECOVERY', 'DUPLICATE_EVENT_DELIVERY',
  'OUT_OF_ORDER_EVENTS', 'CONTACT_ABUSE', 'STAFF_SNOOPING'
] as const;
export type CommunicationAcceptanceScenario = (typeof COMMUNICATION_ACCEPTANCE_SCENARIOS)[number];

export const COMMUNICATION_LAUNCH_GATES = [
  'P0_POLICY_TEMPLATE_FALLBACK_APPROVED',
  'RECIPIENT_PERMISSION_MATRIX_TESTED',
  'NON_SMARTPHONE_FLOW_REHEARSED',
  'VOICE_HANDOFF_RESUME_PAYMENT_TESTED',
  'PROVIDER_OUTAGE_RECOVERY_SIMULATED',
  'CRITICAL_WORKFLOW_DRILLS_PASSED',
  'SECURITY_DEGRADED_FALLBACK_TESTED',
  'DELIVERY_TELEMETRY_STATES_DISTINCT',
  'UNMANAGED_PROVIDER_BYPASS_BLOCKED',
  'CRITICAL_TEMPLATE_GOVERNANCE_READY',
  'OPERATOR_ACCESS_AND_EXPORT_AUDIT_READY',
  'PRIVACY_AND_RETENTION_RULES_APPROVED',
  'OUTAGE_AND_ABUSE_RUNBOOKS_READY'
] as const;
export type CommunicationLaunchGate = (typeof COMMUNICATION_LAUNCH_GATES)[number];

function present(value: string): boolean {
  return value.trim().length > 0;
}

function validVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function evaluateCanonicalCommunicationRequest(input: {
  readonly communicationRequestId: string;
  readonly idempotencyKey: string;
  readonly sourceDomain: CommunicationSourceDomain;
  readonly sourceEventId: string;
  readonly sourceEventRecorded: boolean;
  readonly purpose: string;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  readonly recipientRole: CommunicationRecipientRole;
  readonly recipientRef: string;
  readonly recipientPermissionResolved: boolean;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly criticalTemplateApproved: boolean;
  readonly approvedPayloadVariableNames: readonly string[];
  readonly payloadContainsArbitrarySourceObject: boolean;
  readonly stateVersion: number;
  readonly currentStateVersion: number;
  readonly timeSensitive: boolean;
  readonly classification: CommunicationDataClassification;
  readonly acknowledgementPolicyDefined: boolean;
  readonly fallbackPolicyVersionRef: string;
  readonly correlationId: string;
}): {
  readonly accepted: boolean;
  readonly blockers: readonly string[];
  readonly staleSuppressed: boolean;
  readonly priorityGrantsAdditionalDataAccess: false;
  readonly rawContactAcceptedFromSourceDomain: false;
  readonly arbitrarySourceObjectStored: false;
  readonly businessStateInventedByCommunications: false;
} {
  if (!validVersion(input.templateVersion) || !validVersion(input.stateVersion) || !validVersion(input.currentStateVersion)) {
    throw new Error('Template and aggregate versions must be positive safe integers');
  }
  const blockers: string[] = [];
  if (!present(input.communicationRequestId)) blockers.push('COMMUNICATION_REQUEST_ID_REQUIRED');
  if (!present(input.idempotencyKey)) blockers.push('IDEMPOTENCY_KEY_REQUIRED');
  if (!input.sourceEventRecorded || !present(input.sourceEventId)) blockers.push('IMMUTABLE_SOURCE_EVENT_REQUIRED');
  if (!present(input.purpose)) blockers.push('EXPLICIT_PURPOSE_REQUIRED');
  if (!present(input.recipientRef)) blockers.push('AUTHORITATIVE_RECIPIENT_REFERENCE_REQUIRED');
  if (!input.recipientPermissionResolved) blockers.push('RECIPIENT_PERMISSION_REQUIRED');
  if (!present(input.templateId)) blockers.push('APPROVED_TEMPLATE_REFERENCE_REQUIRED');
  if (['P0', 'P1'].includes(input.priority) && !input.criticalTemplateApproved) {
    blockers.push('CRITICAL_TEMPLATE_APPROVAL_REQUIRED');
  }
  if (input.approvedPayloadVariableNames.length === 0) blockers.push('APPROVED_PAYLOAD_VARIABLES_REQUIRED');
  if (input.payloadContainsArbitrarySourceObject) blockers.push('ARBITRARY_SOURCE_OBJECT_DUMP_PROHIBITED');
  const staleSuppressed = input.timeSensitive && input.stateVersion !== input.currentStateVersion;
  if (staleSuppressed) blockers.push('STALE_AUTHORITATIVE_STATE_SUPPRESSED');
  if (!input.acknowledgementPolicyDefined) blockers.push('ACKNOWLEDGEMENT_POLICY_REQUIRED');
  if (!present(input.fallbackPolicyVersionRef)) blockers.push('VERSIONED_FALLBACK_POLICY_REQUIRED');
  if (!present(input.correlationId)) blockers.push('CORRELATION_ID_REQUIRED');
  return {
    accepted: blockers.length === 0,
    blockers,
    staleSuppressed,
    priorityGrantsAdditionalDataAccess: false,
    rawContactAcceptedFromSourceDomain: false,
    arbitrarySourceObjectStored: false,
    businessStateInventedByCommunications: false
  };
}

export function evaluateCommunicationEventEnvelope(input: {
  readonly eventId: string;
  readonly eventType: string;
  readonly duplicateEvent: boolean;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly occurredAtRecorded: boolean;
  readonly recordedAtRecorded: boolean;
  readonly region: string;
  readonly serviceContext: string;
  readonly classification: CommunicationDataClassification;
  readonly correlationId: string;
  readonly causationId: string;
  readonly payloadSchemaVersionSupported: boolean;
}): {
  readonly accepted: boolean;
  readonly deduplicated: boolean;
  readonly blockers: readonly string[];
  readonly occurrenceTimeSeparateFromRecordingTime: true;
  readonly unsupportedCriticalSchemaFailsClosed: true;
} {
  if (!validVersion(input.aggregateVersion)) throw new Error('Aggregate version must be a positive safe integer');
  const blockers: string[] = [];
  if (!present(input.eventId)) blockers.push('EVENT_ID_REQUIRED');
  if (!/\.v[1-9][0-9]*$/.test(input.eventType)) blockers.push('VERSIONED_EVENT_TYPE_REQUIRED');
  if (!present(input.aggregateType) || !present(input.aggregateId)) blockers.push('AGGREGATE_REFERENCE_REQUIRED');
  if (!input.occurredAtRecorded || !input.recordedAtRecorded) blockers.push('OCCURRENCE_AND_RECORDING_TIME_REQUIRED');
  if (!present(input.region) || !present(input.serviceContext)) blockers.push('REGION_AND_SERVICE_CONTEXT_REQUIRED');
  if (!present(input.correlationId) || !present(input.causationId)) blockers.push('CORRELATION_AND_CAUSATION_REQUIRED');
  if (!input.payloadSchemaVersionSupported) blockers.push('UNSUPPORTED_PAYLOAD_SCHEMA');
  if (input.duplicateEvent) blockers.push('DUPLICATE_EVENT_DEDUPLICATED');
  return {
    accepted: blockers.length === 0,
    deduplicated: input.duplicateEvent,
    blockers,
    occurrenceTimeSeparateFromRecordingTime: true,
    unsupportedCriticalSchemaFailsClosed: true
  };
}

export function evaluateRecipientPermissionScope(input: {
  readonly role: CommunicationRecipientRole;
  readonly roleSpecificAuthorityPresent: boolean;
  readonly activeTaskPresent: boolean;
  readonly minimumNecessaryPayload: boolean;
  readonly containsPayerOnlyFinancialData: boolean;
  readonly containsPrivateSupportOrSafetyData: boolean;
  readonly containsInternalCaseNotes: boolean;
  readonly containsUnnecessaryMedicalDiagnosis: boolean;
  readonly containsUnrelatedChildRecords: boolean;
  readonly containsWholeBookingHistory: boolean;
}): {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly unrestrictedRelationshipVisibilityGranted: false;
  readonly roleResolvedBeforeChannelDelivery: true;
} {
  const blockers: string[] = [];
  if (!input.roleSpecificAuthorityPresent) blockers.push('ROLE_SPECIFIC_AUTHORITY_REQUIRED');
  if (!input.minimumNecessaryPayload) blockers.push('MINIMUM_NECESSARY_PAYLOAD_REQUIRED');
  if (input.containsInternalCaseNotes) blockers.push('INTERNAL_CASE_NOTES_EXCLUDED');
  if (input.role === 'PASSENGER' && input.containsPayerOnlyFinancialData) blockers.push('PAYER_ONLY_FINANCE_EXCLUDED');
  if (input.role === 'BOOKER' && input.containsPayerOnlyFinancialData) blockers.push('BOOKER_PAYER_SCOPE_EXCEEDED');
  if (input.role === 'GUARDIAN_CARER'
      && (input.containsPayerOnlyFinancialData || input.containsWholeBookingHistory)) {
    blockers.push('GUARDIAN_CARER_SCOPE_EXCEEDED');
  }
  if (input.role === 'SAFETY_OPERATOR' && input.containsPayerOnlyFinancialData) blockers.push('SAFETY_SCOPE_EXCEEDED');
  if (['BOOKER', 'PAYER', 'BUSINESS_AUTHORITY_CONTACT'].includes(input.role)
      && input.containsPrivateSupportOrSafetyData) blockers.push('PRIVATE_SUPPORT_SAFETY_EXCLUDED');
  if (input.role === 'BUSINESS_AUTHORITY_CONTACT' && input.containsUnrelatedChildRecords) {
    blockers.push('BUSINESS_AUTHORITY_SCOPE_EXCEEDED');
  }
  if (input.role === 'SCHOOL_CONTACT'
      && (input.containsPayerOnlyFinancialData || input.containsUnrelatedChildRecords)) {
    blockers.push('SCHOOL_SCOPE_EXCEEDED');
  }
  if (input.role === 'DRIVER'
      && (input.containsPayerOnlyFinancialData || input.containsUnnecessaryMedicalDiagnosis || input.containsWholeBookingHistory)) {
    blockers.push('DRIVER_MINIMUM_OPERATIONAL_SCOPE_EXCEEDED');
  }
  if (input.role === 'PARTNER_RESCUE_PROVIDER'
      && (input.containsPayerOnlyFinancialData || input.containsPrivateSupportOrSafetyData || input.containsWholeBookingHistory)) {
    blockers.push('PARTNER_MINIMUM_DISPATCH_SCOPE_EXCEEDED');
  }
  if (input.role === 'CONTROL_ROOM_OPERATOR' && !input.activeTaskPresent) blockers.push('ACTIVE_OPERATOR_TASK_REQUIRED');
  return {
    allowed: blockers.length === 0,
    blockers,
    unrestrictedRelationshipVisibilityGranted: false,
    roleResolvedBeforeChannelDelivery: true
  };
}

export type ClosureRoutingAction =
  | 'ATTEMPT_PRIMARY' | 'WAIT_FOR_DELIVERY_OR_ACKNOWLEDGEMENT' | 'ATTEMPT_FALLBACK'
  | 'OPEN_COMMUNICATION_FAILURE_CASE' | 'COMPLETE' | 'SUPPRESS_STALE'
  | 'STOP_OPERATOR_CONTROL' | 'STOP_ATTEMPT_CAP' | 'REJECT';

export function decideCommunicationsClosureRoute(input: {
  readonly sourceCurrent: boolean;
  readonly recipientPermissionResolved: boolean;
  readonly purposeAndClassificationResolved: boolean;
  readonly validPurposeEligibleContactPointExists: boolean;
  readonly accessibilityLanguageQuietHoursResolved: boolean;
  readonly unsafeChannelsExcluded: boolean;
  readonly activeNotificationAndFallbackPolicy: boolean;
  readonly primaryAttempted: boolean;
  readonly deliveryState: 'NOT_ATTEMPTED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'ACKNOWLEDGED' | 'FAILED' | 'UNKNOWN' | 'EXPIRED';
  readonly acknowledgementRequired: boolean;
  readonly fallbackPolicyAllows: boolean;
  readonly fallbackAvailable: boolean;
  readonly fallbackSourceRevalidated: boolean;
  readonly critical: boolean;
  readonly attemptCount: number;
  readonly attemptCap: number;
  readonly operatorOrIncidentPlanTookControl: boolean;
}): {
  readonly action: ClosureRoutingAction;
  readonly completedDecisionSteps: number;
  readonly providerAcceptanceTreatedAsDelivery: false;
  readonly sentTreatedAsDelivered: false;
  readonly staleFallbackAllowed: false;
} {
  if (!Number.isSafeInteger(input.attemptCount) || input.attemptCount < 0
      || !Number.isSafeInteger(input.attemptCap) || input.attemptCap < 0) {
    throw new Error('Attempt counts must be non-negative safe integers');
  }
  if (!input.sourceCurrent) return route('SUPPRESS_STALE', 1);
  if (!input.recipientPermissionResolved || !input.purposeAndClassificationResolved) return route('REJECT', 3);
  if (!input.validPurposeEligibleContactPointExists || !input.accessibilityLanguageQuietHoursResolved
      || !input.unsafeChannelsExcluded || !input.activeNotificationAndFallbackPolicy) return route('REJECT', 6);
  if (input.operatorOrIncidentPlanTookControl) return route('STOP_OPERATOR_CONTROL', 10);
  if (input.deliveryState === 'ACKNOWLEDGED'
      || (!input.acknowledgementRequired && (input.deliveryState === 'READ' || input.deliveryState === 'DELIVERED'))) {
    return route('COMPLETE', 10);
  }
  if (!input.primaryAttempted || input.deliveryState === 'NOT_ATTEMPTED') return route('ATTEMPT_PRIMARY', 7);
  if (input.attemptCount >= input.attemptCap) {
    return route(input.critical ? 'OPEN_COMMUNICATION_FAILURE_CASE' : 'STOP_ATTEMPT_CAP', 10);
  }
  if (['FAILED', 'UNKNOWN', 'EXPIRED'].includes(input.deliveryState)
      && input.fallbackPolicyAllows && input.fallbackAvailable && input.fallbackSourceRevalidated) {
    return route('ATTEMPT_FALLBACK', 8);
  }
  if (input.critical && ['FAILED', 'UNKNOWN', 'EXPIRED'].includes(input.deliveryState)) {
    return route('OPEN_COMMUNICATION_FAILURE_CASE', 9);
  }
  return route('WAIT_FOR_DELIVERY_OR_ACKNOWLEDGEMENT', 7);
}

function route(action: ClosureRoutingAction, completedDecisionSteps: number): ReturnType<typeof decideCommunicationsClosureRoute> {
  return {
    action,
    completedDecisionSteps,
    providerAcceptanceTreatedAsDelivery: false,
    sentTreatedAsDelivered: false,
    staleFallbackAllowed: false
  };
}

export function decideCommunicationsDegradedMode(input: {
  readonly channelHealth: ChannelProviderHealthState;
  readonly classification: CommunicationPolicyClass;
  readonly recoveryReplayRequested: boolean;
  readonly sourceCurrent: boolean;
  readonly duplicateEvent: boolean;
  readonly shieldAvailable: boolean;
  readonly highRiskAccountOrFinancialChange: boolean;
  readonly essentialJourneySafetyOrSafeguarding: boolean;
  readonly approvedSafeAlternateAvailable: boolean;
}): {
  readonly action: 'NORMAL' | 'APPROVED_FAILOVER' | 'DELAY_ROUTINE' | 'HUMAN_CONTINGENCY'
    | 'HOLD_FOR_REVALIDATION' | 'DISCARD_STALE' | 'DISCARD_DUPLICATE'
    | 'PAUSE_HIGH_RISK_CHANGE' | 'CONTINUE_ESSENTIAL_CANONICAL';
  readonly riskyChangeFailsOpen: false;
  readonly activeJourneyStrandedByShieldOutage: false;
} {
  let action: ReturnType<typeof decideCommunicationsDegradedMode>['action'];
  if (input.duplicateEvent) action = 'DISCARD_DUPLICATE';
  else if (input.recoveryReplayRequested && !input.sourceCurrent) action = 'DISCARD_STALE';
  else if (input.recoveryReplayRequested) action = 'HOLD_FOR_REVALIDATION';
  else if (!input.shieldAvailable && input.highRiskAccountOrFinancialChange) action = 'PAUSE_HIGH_RISK_CHANGE';
  else if (!input.shieldAvailable && input.essentialJourneySafetyOrSafeguarding) action = 'CONTINUE_ESSENTIAL_CANONICAL';
  else if (input.channelHealth === 'HEALTHY') action = 'NORMAL';
  else if (['ROUTINE', 'MARKETING'].includes(input.classification)) action = 'DELAY_ROUTINE';
  else if (input.approvedSafeAlternateAvailable) action = 'APPROVED_FAILOVER';
  else action = 'HUMAN_CONTINGENCY';
  return { action, riskyChangeFailsOpen: false, activeJourneyStrandedByShieldOutage: false };
}

export function communicationsAcceptanceScenarioMayPass(input: {
  readonly scenario: CommunicationAcceptanceScenario;
  readonly fixtureOnly: boolean;
  readonly contactedRealUser: boolean;
  readonly externalProviderCalled: boolean;
  readonly authoritativeStateRevalidated: boolean;
  readonly recipientPermissionsRespected: boolean;
  readonly staleOrDuplicateMessageReleased: boolean;
  readonly silentAssistanceAutoCalledReporter: boolean;
  readonly paymentUnknownAskedBlindRetry: boolean;
  readonly safeguardingUsedOrdinaryNoShow: boolean;
  readonly lowConfidenceVoiceGuessedCommand: boolean;
  readonly staffSnoopingDeniedOrBreakGlassAudited: boolean;
  readonly nonSmartphonePathSucceeded: boolean;
  readonly rideCheckMismatchBlockedJourneyStart: boolean;
  readonly breakdownPassengerContinuityPreserved: boolean;
  readonly highRiskSecurityStepUpApplied: boolean;
  readonly independentSecurityWarningAttempted: boolean;
  readonly accountRecoveredSolelyFromPhonePossession: boolean;
  readonly lowConfidenceVoiceHandedOff: boolean;
  readonly criticalFallbackPrioritizedOverMarketing: boolean;
  readonly protectedContactRestrictedWithoutBlockingSafetySupport: boolean;
  readonly evidenceReferencePresent: boolean;
}): boolean {
  if (!input.fixtureOnly || input.contactedRealUser || input.externalProviderCalled
      || !input.authoritativeStateRevalidated || !input.recipientPermissionsRespected
      || input.staleOrDuplicateMessageReleased || !input.evidenceReferencePresent) return false;
  if (input.scenario === 'SILENT_ASSISTANCE' && input.silentAssistanceAutoCalledReporter) return false;
  if (input.scenario === 'PAYMENT_STATUS_UNKNOWN' && input.paymentUnknownAskedBlindRetry) return false;
  if (input.scenario === 'SCHOOL_HANDOVER_FAILURE' && input.safeguardingUsedOrdinaryNoShow) return false;
  if (input.scenario === 'TELEPHONY_AI_LOW_CONFIDENCE' && input.lowConfidenceVoiceGuessedCommand) return false;
  if (input.scenario === 'TELEPHONY_AI_LOW_CONFIDENCE' && !input.lowConfidenceVoiceHandedOff) return false;
  if (input.scenario === 'STAFF_SNOOPING' && !input.staffSnoopingDeniedOrBreakGlassAudited) return false;
  if (input.scenario === 'LANDLINE_ONLY_PASSENGER' && !input.nonSmartphonePathSucceeded) return false;
  if (input.scenario === 'RIDECHECK_MISMATCH' && !input.rideCheckMismatchBlockedJourneyStart) return false;
  if (input.scenario === 'PASSENGER_ONBOARD_BREAKDOWN' && !input.breakdownPassengerContinuityPreserved) return false;
  if (input.scenario === 'PAYOUT_BANK_TAKEOVER'
      && (!input.highRiskSecurityStepUpApplied || !input.independentSecurityWarningAttempted)) return false;
  if (input.scenario === 'SIM_SWAP_OTP_FLOOD' && input.accountRecoveredSolelyFromPhonePossession) return false;
  if (input.scenario === 'SMS_OUTAGE' && !input.criticalFallbackPrioritizedOverMarketing) return false;
  if (input.scenario === 'CONTACT_ABUSE'
      && !input.protectedContactRestrictedWithoutBlockingSafetySupport) return false;
  return true;
}

export function evaluateCommunicationsLaunchReadiness(input: {
  readonly evidence: Readonly<Record<CommunicationLaunchGate, 'PASS' | 'FAIL' | 'NOT_TESTED'>>;
  readonly productionPoliciesApproved: boolean;
  readonly providerSelectedAndContracted: boolean;
  readonly operationsStaffingApproved: boolean;
  readonly privacyRetentionApproved: boolean;
}): {
  readonly evidenceComplete: boolean;
  readonly unmetGates: readonly CommunicationLaunchGate[];
  readonly accountableApprovalsComplete: boolean;
  readonly pilotReadyRecommendation: boolean;
  readonly providerExecutionMayBeEnabledAtThisCheckpoint: false;
} {
  const unmetGates = COMMUNICATION_LAUNCH_GATES.filter((gate) => input.evidence[gate] !== 'PASS');
  const accountableApprovalsComplete = input.productionPoliciesApproved
    && input.providerSelectedAndContracted
    && input.operationsStaffingApproved
    && input.privacyRetentionApproved;
  return {
    evidenceComplete: unmetGates.length === 0,
    unmetGates,
    accountableApprovalsComplete,
    pilotReadyRecommendation: unmetGates.length === 0 && accountableApprovalsComplete,
    providerExecutionMayBeEnabledAtThisCheckpoint: false
  };
}

export const COMMUNICATIONS_MAY_INVENT_BUSINESS_STATE = false as const;
export const ENDPOINT_CALL_GRANTS_DOMAIN_AUTHORITY = false as const;
export const UNMANAGED_PROVIDER_BYPASS_ALLOWED = false as const;
export const VOICE_AI_HIGH_RISK_DECISION_ALLOWED = false as const;
export const COMMUNICATIONS_PRODUCTION_EXECUTION_ENABLED = false as const;
export const COMMUNICATIONS_CLOSURE_MUTATIONS_ENABLED = false as const;
export const COMMUNICATION_CONTENT_BROADLY_INDEXED_FOR_DASHBOARDS = false as const;
export const CONTACT_VERIFICATION_GRANTS_UNLIMITED_AUTHORITY = false as const;
