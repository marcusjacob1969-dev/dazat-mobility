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
  COMMUNICATIONS_OPERATIONS_PROVIDER_EXECUTION_ENABLED,
  COMMUNICATIONS_SCENARIO_CONTACTS_REAL_USERS,
  CONTACTABILITY_MAY_BECOME_LONG_TERM_PERSONAL_RATING,
  CONTACT_CASE_MAY_REPLACE_CANONICAL_DOMAIN_CASE,
  CONTACT_CENTRE_STAFF_MUTATION_ENABLED,
  OBSERVABILITY_EXPOSES_SENSITIVE_MESSAGE_CONTENT_BY_DEFAULT,
  PERSONAL_EMAIL_OR_SMS_WORKAROUND_ALLOWED,
  PROVIDER_ACCEPTANCE_PROVES_DELIVERY,
  RECOVERY_MAY_RELEASE_STALE_MESSAGES_BLINDLY,
  communicationsScenarioMayPass,
  deliveryAssuranceDecision,
  evaluateContactCaseOwnership,
  evaluateNotificationPolicy,
  observabilityMetricMayBeRecorded,
  providerOutageRoutingDecision
} = await import('../../packages/domain/src/communications-operations.ts');

function safePolicy(overrides = {}) {
  return {
    authoritativeEventRecorded: true,
    policyVersionActive: true,
    eventTypeMatches: true,
    recipientRoleEligible: true,
    sourceAggregateVersion: 4,
    currentSourceAggregateVersion: 4,
    classification: 'SERVICE_OPERATIONAL',
    primaryChannel: 'IN_APP',
    fallbackChannels: ['SMS'],
    unsafeChannels: [],
    marketingConsent: false,
    marketingRelabelledAsOperational: false,
    silentAssistance: false,
    paymentStatusUnknown: false,
    templateAsksRecipientToRetryPayment: false,
    breakdownContinuityActive: false,
    templateTellsPassengerToRebook: false,
    schoolOrSafeguarding: false,
    consumerNoShowOrCancellationWording: false,
    ...overrides
  };
}

test('communication policy cannot run from a UI guess without an authoritative event', () => {
  const result = evaluateNotificationPolicy(safePolicy({ authoritativeEventRecorded: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('AUTHORITATIVE_DOMAIN_EVENT_REQUIRED'));
  assert.equal(result.businessStateInventedByCommunications, false);
});

test('recipient role remains independently eligible for each event message', () => {
  const result = evaluateNotificationPolicy(safePolicy({ recipientRoleEligible: false }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('RECIPIENT_ROLE_NOT_ELIGIBLE'));
});

test('stale source state is suppressed before a time-sensitive communication', () => {
  const result = evaluateNotificationPolicy(safePolicy({ sourceAggregateVersion: 3 }));
  assert.equal(result.staleSuppressed, true);
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('STALE_SOURCE_VERSION_SUPPRESSED'));
});

test('marketing needs consent and cannot borrow an operational identity', () => {
  const result = evaluateNotificationPolicy(safePolicy({
    classification: 'MARKETING', marketingConsent: false, marketingRelabelledAsOperational: true
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('MARKETING_CONSENT_REQUIRED'));
  assert.ok(result.blockers.includes('MARKETING_OPERATIONAL_RELABEL_PROHIBITED'));
});

test('silent assistance preserves do-not-call across fallback routing', () => {
  const result = evaluateNotificationPolicy(safePolicy({
    classification: 'SAFETY_CRITICAL', primaryChannel: 'AUTOMATED_VOICE',
    fallbackChannels: ['OPERATOR_CALL', 'PROTECTED_CHAT'], silentAssistance: true
  }));
  assert.deepEqual(result.permittedChannels, ['PROTECTED_CHAT']);
  assert.equal(result.allowed, true);
});

test('payment STATUS_UNKNOWN wording can never tell the payer to retry', () => {
  const result = evaluateNotificationPolicy(safePolicy({
    classification: 'FINANCIAL', paymentStatusUnknown: true, templateAsksRecipientToRetryPayment: true
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('STATUS_UNKNOWN_RETRY_WORDING_PROHIBITED'));
});

test('breakdown continuity cannot tell the passenger to rebook', () => {
  const result = evaluateNotificationPolicy(safePolicy({
    classification: 'ACTIVE_JOURNEY', breakdownContinuityActive: true, templateTellsPassengerToRebook: true
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('BREAKDOWN_CONTINUITY_MUST_PRESERVE_BOOKING'));
});

test('school safeguarding never uses generic no-show or cancellation wording', () => {
  const result = evaluateNotificationPolicy(safePolicy({
    classification: 'SAFEGUARDING', schoolOrSafeguarding: true, consumerNoShowOrCancellationWording: true
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('SAFEGUARDING_CONSUMER_WORDING_PROHIBITED'));
});

test('provider acceptance or SENT state does not complete delivery assurance', () => {
  const result = deliveryAssuranceDecision({
    classification: 'ROUTINE', deliveryState: 'SENT', attemptCount: 1, retryLimit: 2,
    fallbackChannelAvailable: true, acknowledgementRequired: false, acknowledged: false,
    acknowledgementDeadlinePassed: false, contactability: 'UNKNOWN'
  });
  assert.equal(result.action, 'NO_ACTION');
  assert.equal(result.sentTreatedAsDelivered, false);
  assert.equal(result.deliveredTreatedAsRead, false);
  assert.equal(result.readTreatedAsAcknowledged, false);
});

test('critical recipient unreachable opens an operational failure case', () => {
  const result = deliveryAssuranceDecision({
    classification: 'SAFETY_CRITICAL', deliveryState: 'FAILED', attemptCount: 2, retryLimit: 2,
    fallbackChannelAvailable: false, acknowledgementRequired: true, acknowledged: false,
    acknowledgementDeadlinePassed: true, contactability: 'UNREACHABLE'
  });
  assert.equal(result.action, 'OPEN_COMMUNICATION_FAILURE_CASE');
  assert.equal(result.repeatedChannelHammeringAllowed, false);
});

test('failed channel can use one governed fallback inside retry limits', () => {
  const result = deliveryAssuranceDecision({
    classification: 'SERVICE_OPERATIONAL', deliveryState: 'FAILED', attemptCount: 1, retryLimit: 3,
    fallbackChannelAvailable: true, acknowledgementRequired: false, acknowledged: false,
    acknowledgementDeadlinePassed: false, contactability: 'DEGRADED'
  });
  assert.equal(result.action, 'TRIGGER_FALLBACK');
});

test('P0 and P1 Contact Cases require owner, next action and attention time', () => {
  const result = evaluateContactCaseOwnership({
    priority: 'P0', ownerAssigned: false, nextActionDefined: false, attentionTimeDefined: false,
    transferInProgress: false, receivingOwnerAssigned: false, currentContactStatusKnown: true
  });
  assert.equal(result.valid, false);
  assert.ok(result.blockers.includes('HIGH_RISK_CASE_OWNER_REQUIRED'));
  assert.ok(result.blockers.includes('NEXT_ACTION_REQUIRED'));
  assert.equal(result.channelHistoryMustBePreserved, true);
});

test('Contact Case transfer cannot complete without a receiving owner', () => {
  const result = evaluateContactCaseOwnership({
    priority: 'P1', ownerAssigned: true, nextActionDefined: true, attentionTimeDefined: true,
    transferInProgress: true, receivingOwnerAssigned: false, currentContactStatusKnown: true
  });
  assert.equal(result.valid, false);
  assert.ok(result.blockers.includes('RECEIVING_OWNER_REQUIRED_BEFORE_TRANSFER'));
});

test('provider outage delays marketing and uses only approved rule-preserving failover', () => {
  const marketing = providerOutageRoutingDecision({
    health: 'OUTAGE', classification: 'MARKETING', approvedAlternateRouteAvailable: true,
    privacyConsentAndTemplateRulesPreserved: true, sourceVersionCurrent: true, recoveryReplayRequested: false
  });
  assert.equal(marketing.action, 'DELAY');
  const critical = providerOutageRoutingDecision({
    health: 'OUTAGE', classification: 'ACTIVE_JOURNEY', approvedAlternateRouteAvailable: true,
    privacyConsentAndTemplateRulesPreserved: true, sourceVersionCurrent: true, recoveryReplayRequested: false
  });
  assert.equal(critical.action, 'APPROVED_FAILOVER');
  assert.equal(critical.unrestrictedSecondaryProviderUseAllowed, false);
});

test('recovery discards stale queued work instead of creating a replay storm', () => {
  const result = providerOutageRoutingDecision({
    health: 'RECOVERING', classification: 'ACTIVE_JOURNEY', approvedAlternateRouteAvailable: false,
    privacyConsentAndTemplateRulesPreserved: true, sourceVersionCurrent: false, recoveryReplayRequested: true
  });
  assert.equal(result.action, 'DISCARD_STALE');
  assert.equal(result.replayStormAllowed, false);
});

test('aggregate observability excludes content and unrestricted case surveillance', () => {
  assert.equal(observabilityMetricMayBeRecorded({
    aggregateMetric: true, sensitiveMessageContentIncluded: false,
    unrestrictedCaseDrilldownEnabled: false, providerRegionAndPurposeScoped: true
  }), true);
  assert.equal(observabilityMetricMayBeRecorded({
    aggregateMetric: true, sensitiveMessageContentIncluded: true,
    unrestrictedCaseDrilldownEnabled: false, providerRegionAndPurposeScoped: true
  }), false);
});

test('critical scenarios cover failure ordering and never contact real users', () => {
  const outcomes = [
    'PRIMARY_SUCCESS', 'PRIMARY_FAILURE', 'FALLBACK_SUCCESS', 'ALL_CHANNEL_FAILURE',
    'STALE_EVENT', 'DUPLICATE_EVENT', 'OUT_OF_ORDER_EVENT'
  ];
  assert.equal(communicationsScenarioMayPass({
    classification: 'SAFETY_CRITICAL', testedOutcomes: outcomes, contactedRealUsers: false,
    templateVariablesValidated: true, accessibilityRouteValidated: true
  }), true);
  assert.equal(communicationsScenarioMayPass({
    classification: 'SAFETY_CRITICAL', testedOutcomes: outcomes, contactedRealUsers: true,
    templateVariablesValidated: true, accessibilityRouteValidated: true
  }), false);
});

test('communications operations hard boundaries remain disabled', () => {
  assert.equal(CONTACT_CASE_MAY_REPLACE_CANONICAL_DOMAIN_CASE, false);
  assert.equal(PERSONAL_EMAIL_OR_SMS_WORKAROUND_ALLOWED, false);
  assert.equal(CONTACTABILITY_MAY_BECOME_LONG_TERM_PERSONAL_RATING, false);
  assert.equal(OBSERVABILITY_EXPOSES_SENSITIVE_MESSAGE_CONTENT_BY_DEFAULT, false);
  assert.equal(PROVIDER_ACCEPTANCE_PROVES_DELIVERY, false);
  assert.equal(RECOVERY_MAY_RELEASE_STALE_MESSAGES_BLINDLY, false);
  assert.equal(COMMUNICATIONS_SCENARIO_CONTACTS_REAL_USERS, false);
  assert.equal(COMMUNICATIONS_OPERATIONS_PROVIDER_EXECUTION_ENABLED, false);
  assert.equal(CONTACT_CENTRE_STAFF_MUTATION_ENABLED, false);
});
