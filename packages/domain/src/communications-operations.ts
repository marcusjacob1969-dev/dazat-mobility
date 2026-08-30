export const COMMUNICATION_POLICY_CLASSES = [
  'SAFETY_CRITICAL', 'SAFEGUARDING', 'ACTIVE_JOURNEY', 'SECURITY', 'FINANCIAL',
  'COMPLIANCE', 'SERVICE_OPERATIONAL', 'ROUTINE', 'MARKETING'
] as const;
export type CommunicationPolicyClass = (typeof COMMUNICATION_POLICY_CLASSES)[number];

export const CONTACT_CASE_QUEUES = [
  'SAFETY', 'SCHOOL_SAFEGUARDING', 'ACTIVE_JOURNEY', 'BREAKDOWN', 'ACCOUNT_SECURITY',
  'DRIVER', 'ACCESSIBILITY_ASSISTED', 'PAYMENT', 'COMPLIANCE_FLEET', 'ROUTINE_SUPPORT'
] as const;
export type ContactCaseQueue = (typeof CONTACT_CASE_QUEUES)[number];

export const CONTACTABILITY_STATES = ['REACHABLE', 'DEGRADED', 'UNREACHABLE', 'UNKNOWN'] as const;
export type ContactabilityState = (typeof CONTACTABILITY_STATES)[number];

export const CHANNEL_PROVIDER_HEALTH_STATES = [
  'HEALTHY', 'DEGRADED', 'PARTIAL_OUTAGE', 'OUTAGE', 'RECOVERING', 'UNKNOWN'
] as const;
export type ChannelProviderHealthState = (typeof CHANNEL_PROVIDER_HEALTH_STATES)[number];

export type Omnichannel =
  | 'IN_APP' | 'PUSH' | 'SMS' | 'EMAIL' | 'PROTECTED_CHAT' | 'MASKED_CALL'
  | 'AUTOMATED_VOICE' | 'OPERATOR_CALL' | 'PORTAL' | 'LANDLINE' | 'TEXT_RELAY'
  | 'CARER_OR_RECEPTION';

const voiceChannels: readonly Omnichannel[] = ['MASKED_CALL', 'AUTOMATED_VOICE', 'OPERATOR_CALL', 'LANDLINE'];
const criticalPolicyClasses: readonly CommunicationPolicyClass[] = [
  'SAFETY_CRITICAL', 'SAFEGUARDING', 'ACTIVE_JOURNEY', 'SECURITY'
];

export function evaluateNotificationPolicy(input: {
  readonly authoritativeEventRecorded: boolean;
  readonly policyVersionActive: boolean;
  readonly eventTypeMatches: boolean;
  readonly recipientRoleEligible: boolean;
  readonly sourceAggregateVersion: number;
  readonly currentSourceAggregateVersion: number;
  readonly classification: CommunicationPolicyClass;
  readonly primaryChannel: Omnichannel;
  readonly fallbackChannels: readonly Omnichannel[];
  readonly unsafeChannels: readonly Omnichannel[];
  readonly marketingConsent: boolean;
  readonly marketingRelabelledAsOperational: boolean;
  readonly silentAssistance: boolean;
  readonly paymentStatusUnknown: boolean;
  readonly templateAsksRecipientToRetryPayment: boolean;
  readonly breakdownContinuityActive: boolean;
  readonly templateTellsPassengerToRebook: boolean;
  readonly schoolOrSafeguarding: boolean;
  readonly consumerNoShowOrCancellationWording: boolean;
}): {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly permittedChannels: readonly Omnichannel[];
  readonly staleSuppressed: boolean;
  readonly humanEscalationRequired: boolean;
  readonly businessStateInventedByCommunications: false;
} {
  if (!Number.isSafeInteger(input.sourceAggregateVersion) || input.sourceAggregateVersion < 1
      || !Number.isSafeInteger(input.currentSourceAggregateVersion) || input.currentSourceAggregateVersion < 1) {
    throw new Error('Source aggregate versions must be positive safe integers');
  }
  const blockers: string[] = [];
  if (!input.authoritativeEventRecorded) blockers.push('AUTHORITATIVE_DOMAIN_EVENT_REQUIRED');
  if (!input.policyVersionActive) blockers.push('ACTIVE_NOTIFICATION_POLICY_REQUIRED');
  if (!input.eventTypeMatches) blockers.push('POLICY_EVENT_TYPE_MISMATCH');
  if (!input.recipientRoleEligible) blockers.push('RECIPIENT_ROLE_NOT_ELIGIBLE');
  const staleSuppressed = input.sourceAggregateVersion !== input.currentSourceAggregateVersion;
  if (staleSuppressed) blockers.push('STALE_SOURCE_VERSION_SUPPRESSED');
  if (input.classification === 'MARKETING' && !input.marketingConsent) blockers.push('MARKETING_CONSENT_REQUIRED');
  if (input.marketingRelabelledAsOperational) blockers.push('MARKETING_OPERATIONAL_RELABEL_PROHIBITED');
  if (input.paymentStatusUnknown && input.templateAsksRecipientToRetryPayment) {
    blockers.push('STATUS_UNKNOWN_RETRY_WORDING_PROHIBITED');
  }
  if (input.breakdownContinuityActive && input.templateTellsPassengerToRebook) {
    blockers.push('BREAKDOWN_CONTINUITY_MUST_PRESERVE_BOOKING');
  }
  if (input.schoolOrSafeguarding && input.consumerNoShowOrCancellationWording) {
    blockers.push('SAFEGUARDING_CONSUMER_WORDING_PROHIBITED');
  }

  const ordered = [input.primaryChannel, ...input.fallbackChannels]
    .filter((channel, index, all) => all.indexOf(channel) === index);
  const permittedChannels = ordered.filter((channel) => {
    if (input.unsafeChannels.includes(channel)) return false;
    return !input.silentAssistance || !voiceChannels.includes(channel);
  });
  const humanEscalationRequired = criticalPolicyClasses.includes(input.classification)
    && (permittedChannels.length === 0 || blockers.length > 0);
  return {
    allowed: blockers.length === 0 && permittedChannels.length > 0,
    blockers,
    permittedChannels,
    staleSuppressed,
    humanEscalationRequired,
    businessStateInventedByCommunications: false
  };
}

export function deliveryAssuranceDecision(input: {
  readonly classification: CommunicationPolicyClass;
  readonly deliveryState: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'UNKNOWN' | 'EXPIRED';
  readonly attemptCount: number;
  readonly retryLimit: number;
  readonly fallbackChannelAvailable: boolean;
  readonly acknowledgementRequired: boolean;
  readonly acknowledged: boolean;
  readonly acknowledgementDeadlinePassed: boolean;
  readonly contactability: ContactabilityState;
}): {
  readonly action: 'COMPLETE' | 'WAIT_FOR_ACKNOWLEDGEMENT' | 'TRIGGER_FALLBACK' | 'OPEN_COMMUNICATION_FAILURE_CASE' | 'NO_ACTION';
  readonly sentTreatedAsDelivered: false;
  readonly deliveredTreatedAsRead: false;
  readonly readTreatedAsAcknowledged: false;
  readonly repeatedChannelHammeringAllowed: false;
} {
  if (!Number.isSafeInteger(input.attemptCount) || input.attemptCount < 0
      || !Number.isSafeInteger(input.retryLimit) || input.retryLimit < 0) {
    throw new Error('Delivery attempt counts must be non-negative safe integers');
  }
  const critical = criticalPolicyClasses.includes(input.classification);
  if (input.acknowledgementRequired && input.acknowledged) return assurance('COMPLETE');
  if (!input.acknowledgementRequired && ['DELIVERED', 'READ'].includes(input.deliveryState)) return assurance('COMPLETE');
  if (input.acknowledgementRequired && ['DELIVERED', 'READ'].includes(input.deliveryState)
      && !input.acknowledgementDeadlinePassed) return assurance('WAIT_FOR_ACKNOWLEDGEMENT');
  if (critical && (input.contactability === 'UNREACHABLE' || input.acknowledgementDeadlinePassed
      || input.attemptCount >= input.retryLimit && !input.fallbackChannelAvailable)) {
    return assurance('OPEN_COMMUNICATION_FAILURE_CASE');
  }
  if (input.fallbackChannelAvailable && input.attemptCount < input.retryLimit
      && ['FAILED', 'UNKNOWN', 'EXPIRED'].includes(input.deliveryState)) return assurance('TRIGGER_FALLBACK');
  return assurance('NO_ACTION');
}

function assurance(action: ReturnType<typeof deliveryAssuranceDecision>['action']): ReturnType<typeof deliveryAssuranceDecision> {
  return {
    action,
    sentTreatedAsDelivered: false,
    deliveredTreatedAsRead: false,
    readTreatedAsAcknowledged: false,
    repeatedChannelHammeringAllowed: false
  };
}

export function evaluateContactCaseOwnership(input: {
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  readonly ownerAssigned: boolean;
  readonly nextActionDefined: boolean;
  readonly attentionTimeDefined: boolean;
  readonly transferInProgress: boolean;
  readonly receivingOwnerAssigned: boolean;
  readonly currentContactStatusKnown: boolean;
}): { readonly valid: boolean; readonly blockers: readonly string[]; readonly channelHistoryMustBePreserved: true } {
  const blockers: string[] = [];
  const highRisk = input.priority === 'P0' || input.priority === 'P1';
  if (highRisk && !input.ownerAssigned) blockers.push('HIGH_RISK_CASE_OWNER_REQUIRED');
  if (!input.nextActionDefined) blockers.push('NEXT_ACTION_REQUIRED');
  if (!input.attentionTimeDefined) blockers.push('ATTENTION_TIME_REQUIRED');
  if (!input.currentContactStatusKnown) blockers.push('CURRENT_CONTACT_STATUS_REQUIRED');
  if (input.transferInProgress && !input.receivingOwnerAssigned) blockers.push('RECEIVING_OWNER_REQUIRED_BEFORE_TRANSFER');
  return { valid: blockers.length === 0, blockers, channelHistoryMustBePreserved: true };
}

export function providerOutageRoutingDecision(input: {
  readonly health: ChannelProviderHealthState;
  readonly classification: CommunicationPolicyClass;
  readonly approvedAlternateRouteAvailable: boolean;
  readonly privacyConsentAndTemplateRulesPreserved: boolean;
  readonly sourceVersionCurrent: boolean;
  readonly recoveryReplayRequested: boolean;
}): {
  readonly action: 'NORMAL_ROUTE' | 'DELAY' | 'APPROVED_FAILOVER' | 'HUMAN_CONTINGENCY' | 'HOLD_FOR_REVALIDATION' | 'DISCARD_STALE';
  readonly unrestrictedSecondaryProviderUseAllowed: false;
  readonly replayStormAllowed: false;
} {
  if (input.health === 'RECOVERING' && input.recoveryReplayRequested) {
    return outageDecision(input.sourceVersionCurrent ? 'HOLD_FOR_REVALIDATION' : 'DISCARD_STALE');
  }
  if (input.health === 'HEALTHY') return outageDecision('NORMAL_ROUTE');
  if (input.classification === 'MARKETING' || input.classification === 'ROUTINE') return outageDecision('DELAY');
  if (input.approvedAlternateRouteAvailable && input.privacyConsentAndTemplateRulesPreserved) {
    return outageDecision('APPROVED_FAILOVER');
  }
  return outageDecision('HUMAN_CONTINGENCY');
}

function outageDecision(action: ReturnType<typeof providerOutageRoutingDecision>['action']): ReturnType<typeof providerOutageRoutingDecision> {
  return { action, unrestrictedSecondaryProviderUseAllowed: false, replayStormAllowed: false };
}

export function observabilityMetricMayBeRecorded(input: {
  readonly aggregateMetric: boolean;
  readonly sensitiveMessageContentIncluded: boolean;
  readonly unrestrictedCaseDrilldownEnabled: boolean;
  readonly providerRegionAndPurposeScoped: boolean;
}): boolean {
  return input.aggregateMetric
    && !input.sensitiveMessageContentIncluded
    && !input.unrestrictedCaseDrilldownEnabled
    && input.providerRegionAndPurposeScoped;
}

const requiredCriticalScenarioOutcomes = [
  'PRIMARY_SUCCESS', 'PRIMARY_FAILURE', 'FALLBACK_SUCCESS', 'ALL_CHANNEL_FAILURE',
  'STALE_EVENT', 'DUPLICATE_EVENT', 'OUT_OF_ORDER_EVENT'
] as const;

export function communicationsScenarioMayPass(input: {
  readonly classification: CommunicationPolicyClass;
  readonly testedOutcomes: readonly string[];
  readonly contactedRealUsers: boolean;
  readonly templateVariablesValidated: boolean;
  readonly accessibilityRouteValidated: boolean;
}): boolean {
  const critical = criticalPolicyClasses.includes(input.classification);
  const outcomesCovered = !critical || requiredCriticalScenarioOutcomes.every((outcome) => input.testedOutcomes.includes(outcome));
  return outcomesCovered
    && !input.contactedRealUsers
    && input.templateVariablesValidated
    && input.accessibilityRouteValidated;
}

export const CONTACT_CASE_MAY_REPLACE_CANONICAL_DOMAIN_CASE = false as const;
export const PERSONAL_EMAIL_OR_SMS_WORKAROUND_ALLOWED = false as const;
export const CONTACTABILITY_MAY_BECOME_LONG_TERM_PERSONAL_RATING = false as const;
export const OBSERVABILITY_EXPOSES_SENSITIVE_MESSAGE_CONTENT_BY_DEFAULT = false as const;
export const PROVIDER_ACCEPTANCE_PROVES_DELIVERY = false as const;
export const RECOVERY_MAY_RELEASE_STALE_MESSAGES_BLINDLY = false as const;
export const COMMUNICATIONS_SCENARIO_CONTACTS_REAL_USERS = false as const;
export const COMMUNICATIONS_OPERATIONS_PROVIDER_EXECUTION_ENABLED = false as const;
export const CONTACT_CENTRE_STAFF_MUTATION_ENABLED = false as const;
