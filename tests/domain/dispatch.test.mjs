import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionDriverAvailability,
  canTransitionDriverOffer,
  evaluateDriverDispatchEligibility,
  isLocationFresh
} from '../../packages/domain/dist/dispatch.js';

const now = new Date('2026-08-29T10:00:00.000Z');

function eligibleInput(overrides = {}) {
  return {
    accountActive: true,
    driverProfileApproved: true,
    complianceStatus: 'ELIGIBLE',
    complianceValidUntil: new Date('2026-09-29T10:00:00.000Z'),
    vehicleAuthorised: true,
    vehicleStatus: 'ELIGIBLE',
    vehicleValidUntil: new Date('2026-09-29T10:00:00.000Z'),
    availabilityStatus: 'AVAILABLE',
    locationObservedAt: new Date('2026-08-29T09:59:30.000Z'),
    locationConfidence: 0.95,
    minimumLocationConfidence: 0.5,
    maxLocationAgeSeconds: 90,
    hasActiveAssignment: false,
    hasScheduleConflict: false,
    hardRequirementsMatch: true,
    ...overrides
  };
}

test('only a fully eligible driver passes the hard filter', () => {
  assert.deepEqual(evaluateDriverDispatchEligibility(eligibleInput(), now), { eligible: true, blockers: [] });
});

test('authentication and online intent cannot override expired compliance', () => {
  const result = evaluateDriverDispatchEligibility(
    eligibleInput({ complianceValidUntil: new Date('2026-08-29T09:00:00.000Z') }),
    now
  );
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes('COMPLIANCE_EXPIRED'));
});

test('stale location is explicit and cannot enter the candidate pool', () => {
  const result = evaluateDriverDispatchEligibility(
    eligibleInput({ locationObservedAt: new Date('2026-08-29T09:55:00.000Z') }),
    now
  );
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.includes('LOCATION_STALE'));
  assert.equal(isLocationFresh(new Date('2026-08-29T09:59:30.000Z'), now, 90), true);
});

test('availability and offer state machines reject unsafe shortcuts', () => {
  assert.equal(canTransitionDriverAvailability('OFFLINE', 'ASSIGNED'), false);
  assert.equal(canTransitionDriverAvailability('ASSIGNED', 'OFFLINE'), false);
  assert.equal(canTransitionDriverAvailability('AVAILABLE', 'OFFERED'), true);
  assert.equal(canTransitionDriverOffer('OFFERED', 'ACCEPTED'), true);
  assert.equal(canTransitionDriverOffer('ACCEPTED', 'WITHDRAWN'), false);
});
