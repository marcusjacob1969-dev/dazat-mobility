import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCurrencyCode, assertMoneyMinorUnits, isQuoteUsable } from '../../packages/domain/dist/pricing.js';

test('quote money remains integer minor units with explicit currency', () => {
  assert.equal(assertMoneyMinorUnits(1000), 1000);
  assert.throws(() => assertMoneyMinorUnits(10.5), /minor units/);
  assert.equal(assertCurrencyCode('gbp'), 'GBP');
  assert.throws(() => assertCurrencyCode('£'), /three-letter/);
});

test('only an unexpired OFFERED quote can be accepted', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  assert.equal(isQuoteUsable('OFFERED', new Date('2026-08-28T12:15:00Z'), now), true);
  assert.equal(isQuoteUsable('ACCEPTED', new Date('2026-08-28T12:15:00Z'), now), false);
  assert.equal(isQuoteUsable('OFFERED', new Date('2026-08-28T11:59:59Z'), now), false);
});
