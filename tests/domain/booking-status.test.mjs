import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORITATIVE_BOOKING_STATUSES,
  EXCEPTION_BOOKING_STATUSES,
  canUseCanonicalForwardTransition,
  assertCanonicalForwardTransition
} from '../../packages/domain/dist/index.js';

test('canonical booking vocabulary includes blueprint states', () => {
  assert.ok(AUTHORITATIVE_BOOKING_STATUSES.includes('AWAITING_RIDECHECK'));
  assert.ok(AUTHORITATIVE_BOOKING_STATUSES.includes('PAYMENT_PROCESSING'));
  assert.ok(EXCEPTION_BOOKING_STATUSES.includes('NO_ELIGIBLE_DRIVER'));
  assert.ok(EXCEPTION_BOOKING_STATUSES.includes('BREAKDOWN'));
});

test('happy-path forward transitions are guarded', () => {
  assert.equal(canUseCanonicalForwardTransition('DRAFT', 'QUOTE_CREATED'), true);
  assert.equal(canUseCanonicalForwardTransition('DRAFT', 'IN_PROGRESS'), false);
  assert.equal(canUseCanonicalForwardTransition('PAYMENT_PROCESSING', 'PAYMENT_FAILED'), true);
});

test('client cannot arbitrarily jump authoritative booking state', () => {
  assert.throws(() => assertCanonicalForwardTransition('CONFIRMED', 'COMPLETED'));
});
