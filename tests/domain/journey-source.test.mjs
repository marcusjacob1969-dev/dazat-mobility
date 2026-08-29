import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canStartJourney,
  canTransitionJourney,
  evaluateArrivalEvidence,
  evaluateLocationEvidence,
  evaluateRideCheckAttempt
} from '../../packages/domain/src/journey.ts';
import {
  constantTimeHexEqual,
  createVerificationSalt,
  hashVerificationCode
} from '../../services/api/src/security/secret-utils.ts';

const receivedAt = new Date('2026-08-29T12:00:00.000Z');
const policy = {
  maxAgeSeconds: 60,
  maximumFutureSkewSeconds: 15,
  maximumAccuracyMetres: 75,
  minimumConfidence: 0.7
};

function observation(overrides = {}) {
  return {
    latitude: 53.4808,
    longitude: -2.2426,
    observedAt: new Date('2026-08-29T11:59:45.000Z'),
    receivedAt,
    accuracyMetres: 20,
    confidence: 0.95,
    ...overrides
  };
}

test('Journey state machine has no assigned-to-start or arrival-to-start shortcut', () => {
  assert.equal(canTransitionJourney('ASSIGNED', 'EN_ROUTE'), true);
  assert.equal(canTransitionJourney('ASSIGNED', 'IN_PROGRESS'), false);
  assert.equal(canTransitionJourney('ARRIVED', 'IN_PROGRESS'), false);
  assert.equal(canTransitionJourney('PASSENGER_VERIFIED', 'IN_PROGRESS'), true);
});

test('fresh, accurate and confident pickup evidence inside the radius is accepted', () => {
  const result = evaluateArrivalEvidence(observation(), { latitude: 53.48081, longitude: -2.24259 }, {
    ...policy,
    arrivalRadiusMetres: 200
  });
  assert.equal(result.accepted, true);
  assert.equal(result.state, 'LIVE');
  assert.ok(result.distanceMetres < 5);
});

test('stale location remains explicit and cannot prove arrival', () => {
  const result = evaluateArrivalEvidence(
    observation({ observedAt: new Date('2026-08-29T11:55:00.000Z') }),
    { latitude: 53.4808, longitude: -2.2426 },
    { ...policy, arrivalRadiusMetres: 200 }
  );
  assert.equal(result.accepted, false);
  assert.equal(result.state, 'STALE');
  assert.ok(result.blockers.includes('LOCATION_STALE'));
});

test('low accuracy or confidence is degraded and cannot authorise a critical mutation', () => {
  const result = evaluateLocationEvidence(observation({ accuracyMetres: 200, confidence: 0.4 }), policy);
  assert.equal(result.usable, false);
  assert.equal(result.state, 'DEGRADED');
  assert.deepEqual(result.blockers, ['LOCATION_ACCURACY_LOW', 'LOCATION_CONFIDENCE_LOW']);
});

test('RideCheck mismatch is bounded and exhaustion locks protected start', () => {
  const mismatch = evaluateRideCheckAttempt({
    status: 'PENDING', verifierMatches: false, attemptsUsed: 2, maximumAttempts: 5,
    expiresAt: new Date('2026-08-29T12:10:00.000Z'), now: receivedAt
  });
  assert.deepEqual(mismatch, { accepted: false, nextStatus: 'PENDING', attemptsRemaining: 2, reason: 'MISMATCH' });
  const exhausted = evaluateRideCheckAttempt({
    status: 'PENDING', verifierMatches: false, attemptsUsed: 4, maximumAttempts: 5,
    expiresAt: new Date('2026-08-29T12:10:00.000Z'), now: receivedAt
  });
  assert.deepEqual(exhausted, { accepted: false, nextStatus: 'LOCKED', attemptsRemaining: 0, reason: 'ATTEMPTS_EXHAUSTED' });
});

test('Journey start requires every protected-start condition', () => {
  const allowed = {
    journeyStatus: 'PASSENGER_VERIFIED', rideCheckStatus: 'VERIFIED', assignmentActive: true,
    assignmentStillEligible: true, activeOperationalHold: false, pickupEvidenceAccepted: true
  };
  assert.equal(canStartJourney(allowed), true);
  assert.equal(canStartJourney({ ...allowed, rideCheckStatus: 'PENDING' }), false);
  assert.equal(canStartJourney({ ...allowed, activeOperationalHold: true }), false);
  assert.equal(canStartJourney({ ...allowed, pickupEvidenceAccepted: false }), false);
  assert.equal(canStartJourney({ ...allowed, assignmentStillEligible: false }), false);
});

test('RideCheck verifier is salted, session-bound and compared in constant time', () => {
  const pepper = 'test-only-ridecheck-pepper-at-least-32-characters';
  const salt = createVerificationSalt();
  const expected = hashVerificationCode(pepper, 'session-a', salt, '123456');
  assert.equal(constantTimeHexEqual(expected, hashVerificationCode(pepper, 'session-a', salt, '123456')), true);
  assert.equal(constantTimeHexEqual(expected, hashVerificationCode(pepper, 'session-a', salt, '654321')), false);
  assert.notEqual(expected, hashVerificationCode(pepper, 'session-b', salt, '123456'));
  assert.notEqual(expected, hashVerificationCode(pepper, 'session-a', createVerificationSalt(), '123456'));
});
