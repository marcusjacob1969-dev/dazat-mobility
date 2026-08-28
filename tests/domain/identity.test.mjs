import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionAccountStatus,
  canTransitionRecoveryState,
  isSessionAuthoritative,
  canUseAccountCapability,
  maskContact,
  normaliseContact,
  profileKinds
} from '../../packages/domain/dist/identity.js';

test('account lifecycle rejects reopening a closed account', () => {
  assert.equal(canTransitionAccountStatus('PENDING', 'ACTIVE'), true);
  assert.equal(canTransitionAccountStatus('ACTIVE', 'LIMITED'), true);
  assert.equal(canTransitionAccountStatus('CLOSED', 'ACTIVE'), false);
});

test('limited account mode preserves essential access but blocks security and payout changes', () => {
  assert.equal(canUseAccountCapability('LIMITED', 'SAFETY'), true);
  assert.equal(canUseAccountCapability('LIMITED', 'ACTIVE_JOURNEY'), true);
  assert.equal(canUseAccountCapability('LIMITED', 'SUPPORT'), true);
  assert.equal(canUseAccountCapability('LIMITED', 'CHANGE_SECURITY'), false);
  assert.equal(canUseAccountCapability('LIMITED', 'CHANGE_PAYOUT'), false);
});

test('registration contact values are normalised and masked without changing the canonical value', () => {
  assert.equal(normaliseContact('EMAIL', '  Raymond.Example@Example.COM '), 'raymond.example@example.com');
  assert.equal(maskContact('EMAIL', 'raymond.example@example.com'), 'ra*************@example.com');
  assert.equal(normaliseContact('MOBILE', '+44 7700 900123'), '+447700900123');
  assert.equal(maskContact('MOBILE', '+447700900123'), '••••0123');
});

test('registration phone contacts require an international E.164 value', () => {
  assert.throws(() => normaliseContact('MOBILE', '07700 900123'), /E\.164/);
});

test('one person can intentionally receive both Rider and Driver profiles', () => {
  assert.deepEqual(profileKinds('RIDER'), ['RIDER']);
  assert.deepEqual(profileKinds('DRIVER'), ['DRIVER']);
  assert.deepEqual(profileKinds('BOTH'), ['RIDER', 'DRIVER']);
});


test('account recovery follows an explicit state machine', () => {
  assert.equal(canTransitionRecoveryState('STARTED', 'IDENTITY_ASSESSMENT'), true);
  assert.equal(canTransitionRecoveryState('IDENTITY_ASSESSMENT', 'RECOVERY_COMPLETE'), false);
  assert.equal(canTransitionRecoveryState('RECOVERY_APPROVED', 'SECURITY_RESET'), true);
  assert.equal(canTransitionRecoveryState('RECOVERY_COMPLETE', 'STARTED'), false);
});

test('only unexpired ACTIVE sessions are authoritative', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  assert.equal(isSessionAuthoritative('ACTIVE', new Date('2026-08-28T13:00:00Z'), now), true);
  assert.equal(isSessionAuthoritative('STEP_UP_REQUIRED', new Date('2026-08-28T13:00:00Z'), now), false);
  assert.equal(isSessionAuthoritative('ACTIVE', new Date('2026-08-28T11:59:59Z'), now), false);
});
