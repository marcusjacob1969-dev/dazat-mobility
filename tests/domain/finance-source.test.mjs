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
  assertBalancedLedger,
  assertNoRawPaymentSecrets,
  canBlindRetryPaymentAction,
  canTransitionPaymentStatus,
  evaluateBalancedLedger,
  paymentProviderTimeoutDecision,
  reverseLedgerEntries
} = await import('../../packages/domain/src/finance.ts');
const { canUseAccountCapability } = await import('../../packages/domain/src/identity.ts');
const { loadConfig } = await import('../../services/api/src/config.ts');

const requiredConfig = {
  DATABASE_URL: 'postgresql://example.invalid/dazat',
  REDIS_URL: 'redis://example.invalid',
  CONTACT_VERIFICATION_PEPPER: 'contact-pepper-at-least-32-characters',
  RIDECHECK_PEPPER: 'ridecheck-pepper-at-least-32-characters'
};

test('payment provider configuration fails closed', () => {
  assert.equal(loadConfig({ ...requiredConfig }).paymentProviderMode, 'disabled');
  assert.equal(loadConfig({ ...requiredConfig, PAYMENT_PROVIDER_MODE: 'disabled' }).paymentProviderMode, 'disabled');
  assert.throws(() => loadConfig({ ...requiredConfig, PAYMENT_PROVIDER_MODE: 'enabled' }), /must remain disabled/);
});

test('limited accounts may read history but cannot prepare new payment state', () => {
  assert.equal(canUseAccountCapability('LIMITED', 'VIEW_FINANCIAL_HISTORY'), true);
  assert.equal(canUseAccountCapability('LIMITED', 'PREPARE_PAYMENT'), false);
  assert.equal(canUseAccountCapability('ACTIVE', 'PREPARE_PAYMENT'), true);
});

test('PaymentIntent cannot jump directly from CREATED to captured money', () => {
  assert.equal(canTransitionPaymentStatus('CREATED', 'PROCESSING'), true);
  assert.equal(canTransitionPaymentStatus('CREATED', 'CAPTURED'), false);
  assert.equal(canTransitionPaymentStatus('AUTHORISED', 'CAPTURED'), true);
  assert.equal(canTransitionPaymentStatus('CAPTURED', 'CREATED'), false);
});

test('provider timeout is unknown and cannot be blindly retried', () => {
  assert.deepEqual(paymentProviderTimeoutDecision(), {
    status: 'STATUS_UNKNOWN', reconciliationRequired: true, blindRetryAllowed: false
  });
  assert.equal(canBlindRetryPaymentAction('STATUS_UNKNOWN'), false);
  assert.equal(canBlindRetryPaymentAction('PROCESSING'), false);
});

test('ledger transactions use positive integer minor units and balance by currency', () => {
  const entries = [
    { accountId: 'provider-clearing', direction: 'DEBIT', amountMinor: 1250, currency: 'GBP' },
    { accountId: 'customer-funds', direction: 'CREDIT', amountMinor: 1250, currency: 'GBP' }
  ];
  const decision = evaluateBalancedLedger(entries);
  assert.equal(decision.balanced, true);
  assert.equal(decision.debitMinor, 1250n);
  assert.equal(decision.creditMinor, 1250n);
  assert.doesNotThrow(() => assertBalancedLedger(entries));
  assert.throws(() => assertBalancedLedger([...entries, {
    accountId: 'unbalanced', direction: 'DEBIT', amountMinor: 1, currency: 'GBP'
  }]));
  assert.throws(() => evaluateBalancedLedger([{ ...entries[0], amountMinor: 12.5 }, entries[1]]));
  assert.throws(() => evaluateBalancedLedger([entries[0], { ...entries[1], currency: 'EUR' }]));
});

test('ledger correction uses a new direction-reversed entry set', () => {
  const original = [
    { accountId: 'a', direction: 'DEBIT', amountMinor: 400, currency: 'GBP' },
    { accountId: 'b', direction: 'CREDIT', amountMinor: 400, currency: 'GBP' }
  ];
  const reversed = reverseLedgerEntries(original);
  assert.deepEqual(reversed.map((entry) => entry.direction), ['CREDIT', 'DEBIT']);
  assert.equal(evaluateBalancedLedger(reversed).balanced, true);
  assert.deepEqual(original.map((entry) => entry.direction), ['DEBIT', 'CREDIT']);
});

test('raw payment secret field names are rejected recursively', () => {
  assert.doesNotThrow(() => assertNoRawPaymentSecrets({ providerTokenReference: 'tok_example', card: { last4: '4242' } }));
  assert.throws(() => assertNoRawPaymentSecrets({ card: { cardNumber: 'not-allowed' } }), /forbidden/);
  assert.throws(() => assertNoRawPaymentSecrets({ card: { card_number: 'not-allowed' } }), /forbidden/);
  assert.throws(() => assertNoRawPaymentSecrets({ safe: [{ CVV: 'not-allowed' }] }), /forbidden/);
});
