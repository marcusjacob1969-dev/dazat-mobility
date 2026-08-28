import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAttemptContactVerification,
  normaliseVerificationCode,
  shouldExpireContactVerification
} from '../../packages/domain/dist/authentication.js';

test('contact verification accepts only a six-digit code shape', () => {
  assert.equal(normaliseVerificationCode(' 012345 '), '012345');
  assert.throws(() => normaliseVerificationCode('12345'), /six digits/);
  assert.throws(() => normaliseVerificationCode('ABC123'), /six digits/);
});

test('pending contact verification stops after expiry or attempt exhaustion', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  assert.equal(canAttemptContactVerification('PENDING', new Date('2026-08-28T12:10:00Z'), 0, 5, now), true);
  assert.equal(canAttemptContactVerification('PENDING', new Date('2026-08-28T12:10:00Z'), 5, 5, now), false);
  assert.equal(canAttemptContactVerification('PENDING', new Date('2026-08-28T11:59:59Z'), 0, 5, now), false);
  assert.equal(shouldExpireContactVerification('PENDING', new Date('2026-08-28T11:59:59Z'), now), true);
  assert.equal(shouldExpireContactVerification('VERIFIED', new Date('2026-08-28T11:59:59Z'), now), false);
});
