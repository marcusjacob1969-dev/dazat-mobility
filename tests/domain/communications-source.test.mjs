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
  CALLER_ID_PROVES_IDENTITY,
  EXTERNAL_COMMUNICATION_PROVIDER_CONFIGURED,
  MARKETING_MAY_BE_RELABELED_OPERATIONAL,
  PERSONAL_CONTACT_DETAILS_EXPOSED_BY_PROTECTED_CONTACT,
  acknowledgementAction,
  assessCommunicationCurrency,
  planCommunicationRoute,
  protectedContactWindowIsActive,
  securityTemplateIsSafe
} = await import('../../packages/domain/src/communications.ts');

test('marketing without consent is suppressed instead of relabelled', () => {
  const decision = planCommunicationRoute({
    purpose: 'MARKETING',
    priority: 'P4',
    candidates: [{ channel: 'EMAIL', contactPointVerified: true, permissionAllowed: true, health: 'HEALTHY', compromised: false }],
    marketingConsentGranted: false,
    quietHoursActive: false,
    silentAssistance: false
  });
  assert.equal(decision.state, 'SUPPRESSED_NO_CONSENT');
  assert.deepEqual(decision.channels, []);
  assert.equal(decision.marketingSeparatedFromOperational, true);
});

test('critical safety communication retains an ordered safe fallback route', () => {
  const decision = planCommunicationRoute({
    purpose: 'SAFETY',
    priority: 'P0',
    candidates: [
      { channel: 'PUSH', contactPointVerified: true, permissionAllowed: true, health: 'DEGRADED', compromised: false },
      { channel: 'SMS', contactPointVerified: true, permissionAllowed: true, health: 'HEALTHY', compromised: false }
    ],
    marketingConsentGranted: false,
    quietHoursActive: true,
    silentAssistance: false
  });
  assert.equal(decision.state, 'ROUTABLE');
  assert.deepEqual(decision.channels, ['PUSH', 'SMS']);
  assert.equal(decision.fallbackRequired, true);
  assert.equal(decision.providerExecutionAuthorised, false);
});

test('silent assistance excludes voice and compromised channels', () => {
  const decision = planCommunicationRoute({
    purpose: 'SAFETY',
    priority: 'P0',
    candidates: [
      { channel: 'VOICE_CALL', contactPointVerified: true, permissionAllowed: true, health: 'HEALTHY', compromised: false },
      { channel: 'SMS', contactPointVerified: true, permissionAllowed: true, health: 'HEALTHY', compromised: true },
      { channel: 'PROTECTED_CHAT', contactPointVerified: true, permissionAllowed: true, health: 'HEALTHY', compromised: false }
    ],
    marketingConsentGranted: false,
    quietHoursActive: false,
    silentAssistance: true
  });
  assert.deepEqual(decision.channels, ['PROTECTED_CHAT']);
  assert.equal(decision.unsafeOrCompromisedChannelsExcluded, true);
});

test('unverified external contact points cannot be routed', () => {
  const decision = planCommunicationRoute({
    purpose: 'BOOKING_OPERATIONAL',
    priority: 'P2',
    candidates: [{ channel: 'SMS', contactPointVerified: false, permissionAllowed: true, health: 'HEALTHY', compromised: false }],
    marketingConsentGranted: false,
    quietHoursActive: false,
    silentAssistance: false
  });
  assert.equal(decision.state, 'NO_SAFE_CHANNEL');
});

test('quiet hours defer non-critical communication but never critical safety', () => {
  const candidate = [{ channel: 'IN_APP', contactPointVerified: true, permissionAllowed: true, health: 'HEALTHY', compromised: false }];
  assert.equal(planCommunicationRoute({
    purpose: 'BUSINESS', priority: 'P3', candidates: candidate,
    marketingConsentGranted: false, quietHoursActive: true, silentAssistance: false
  }).state, 'DEFERRED_QUIET_HOURS');
  assert.equal(planCommunicationRoute({
    purpose: 'SAFETY', priority: 'P0', candidates: candidate,
    marketingConsentGranted: false, quietHoursActive: true, silentAssistance: false
  }).state, 'ROUTABLE');
});

test('stale aggregate versions are suppressed before delivery', () => {
  assert.deepEqual(assessCommunicationCurrency({
    communicationStatus: 'QUEUED',
    sourceAggregateVersion: 4,
    currentAggregateVersion: 5,
    expiresAt: null,
    now: new Date('2030-01-01T00:00:00Z')
  }), { current: false, deliveryAllowed: false, suppressionReason: 'SOURCE_VERSION_STALE' });
});

test('expired communication is never current even when the source version matches', () => {
  const result = assessCommunicationCurrency({
    communicationStatus: 'DELIVERY_PENDING',
    sourceAggregateVersion: 5,
    currentAggregateVersion: 5,
    expiresAt: new Date('2029-12-31T23:59:59Z'),
    now: new Date('2030-01-01T00:00:00Z')
  });
  assert.equal(result.deliveryAllowed, false);
  assert.equal(result.suppressionReason, 'EXPIRED');
});

test('failed critical acknowledgement requires human escalation', () => {
  assert.equal(acknowledgementAction({
    acknowledgementRequired: true,
    deliveryState: 'UNKNOWN',
    acknowledgementDeadline: new Date('2030-01-01T00:05:00Z'),
    acknowledgedAt: null,
    now: new Date('2030-01-01T00:00:00Z')
  }), 'HUMAN_ESCALATION_REQUIRED');
});

test('a recorded acknowledgement closes the acknowledgement loop', () => {
  assert.equal(acknowledgementAction({
    acknowledgementRequired: true,
    deliveryState: 'DELIVERED',
    acknowledgementDeadline: new Date('2030-01-01T00:05:00Z'),
    acknowledgedAt: new Date('2030-01-01T00:01:00Z'),
    now: new Date('2030-01-01T00:02:00Z')
  }), 'ACKNOWLEDGED');
});

test('protected contact is active only inside its legitimate no-disclosure window', () => {
  const base = {
    opensAt: new Date('2030-01-01T00:00:00Z'),
    expiresAt: new Date('2030-01-01T01:00:00Z'),
    now: new Date('2030-01-01T00:30:00Z'),
    linkedCaseOrJourneyActive: true,
    personalContactDetailsExposed: false
  };
  assert.equal(protectedContactWindowIsActive(base), true);
  assert.equal(protectedContactWindowIsActive({ ...base, personalContactDetailsExposed: true }), false);
  assert.equal(protectedContactWindowIsActive({ ...base, now: base.expiresAt }), false);
});

test('security templates never request secrets or device-linking codes', () => {
  assert.equal(securityTemplateIsSafe({
    purpose: 'ACCOUNT_SECURITY', asksForPassword: false, asksForFullPin: false, asksForOtp: false, asksForDeviceLinkingCode: false
  }), true);
  assert.equal(securityTemplateIsSafe({
    purpose: 'ACCOUNT_SECURITY', asksForPassword: false, asksForFullPin: false, asksForOtp: true, asksForDeviceLinkingCode: false
  }), false);
});

test('communications constants retain hard safety boundaries', () => {
  assert.equal(MARKETING_MAY_BE_RELABELED_OPERATIONAL, false);
  assert.equal(CALLER_ID_PROVES_IDENTITY, false);
  assert.equal(PERSONAL_CONTACT_DETAILS_EXPOSED_BY_PROTECTED_CONTACT, false);
  assert.equal(EXTERNAL_COMMUNICATION_PROVIDER_CONFIGURED, false);
});
