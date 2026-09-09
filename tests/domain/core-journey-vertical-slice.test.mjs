import test from 'node:test';
import assert from 'node:assert/strict';
import { runProviderDisabledCoreJourney } from '../../packages/domain/dist/index.js';

const now = new Date('2026-09-09T10:00:00.000Z');
const valid = {
  now,
  quote: { amountMinor: 1250, currency: 'GBP', expiresAt: new Date('2026-09-09T10:15:00.000Z') },
  driver: {
    accountActive: true, driverProfileApproved: true, complianceStatus: 'ELIGIBLE',
    complianceValidUntil: new Date('2027-01-01T00:00:00.000Z'), vehicleAuthorised: true,
    vehicleStatus: 'ELIGIBLE', vehicleValidUntil: new Date('2027-01-01T00:00:00.000Z'),
    servicePermissionMatch: true, operatingRestrictionActive: false, availabilityStatus: 'AVAILABLE',
    locationObservedAt: new Date('2026-09-09T09:59:50.000Z'), locationConfidence: 0.99,
    minimumLocationConfidence: 0.8, maxLocationAgeSeconds: 60, hasActiveAssignment: false,
    hasScheduleConflict: false, fatigueSafetyPassed: true, hardRequirementsMatch: true
  },
  pickup: { latitude: 53.4808, longitude: -2.2426 },
  pickupObservation: { latitude: 53.48081, longitude: -2.24261, observedAt: new Date('2026-09-09T09:59:55.000Z'),
    receivedAt: now, accuracyMetres: 5, confidence: 0.99 },
  locationPolicy: { maxAgeSeconds: 60, maximumFutureSkewSeconds: 5, maximumAccuracyMetres: 30,
    minimumConfidence: 0.8, arrivalRadiusMetres: 80 },
  rideCheck: { verifierMatches: true, expiresAt: new Date('2026-09-09T10:05:00.000Z') },
  completion: { journeyStatus: 'ARRIVING', bookingStatus: 'ARRIVING', assignmentActive: true,
    destinationEvidenceAccepted: true, activeCompletionHold: false, continuityCaseOpen: false,
    handoverRequired: false, authorisedHandoverRecorded: false, handoverFailureOpen: false }
};

test('provider-disabled core journey connects booking through governed completion', () => {
  const result = runProviderDisabledCoreJourney(valid);
  assert.equal(result.completed, true);
  assert.equal(result.bookingStatus, 'COMPLETED');
  assert.equal(result.realPaymentAttempted, false);
  assert.equal(result.externalProviderContacted, false);
  assert.deepEqual(result.milestones.slice(-3), ['IN_PROGRESS', 'ARRIVING', 'COMPLETED']);
});

test('fatigue-blocked Driver cannot enter the connected journey', () => {
  const result = runProviderDisabledCoreJourney({ ...valid, driver: { ...valid.driver, fatigueSafetyPassed: false } });
  assert.equal(result.completed, false);
  assert.equal(result.blocker, 'FATIGUE_SAFETY_BLOCKED');
  assert.equal(result.bookingStatus, 'SEARCHING_FOR_DRIVER');
});

test('failed RideCheck prevents passenger verification and Journey start', () => {
  const result = runProviderDisabledCoreJourney({ ...valid, rideCheck: { ...valid.rideCheck, verifierMatches: false } });
  assert.equal(result.completed, false);
  assert.equal(result.blocker, 'RIDECHECK_MISMATCH');
  assert.equal(result.bookingStatus, 'AWAITING_RIDECHECK');
});

test('active completion hold stops completion without inventing payment or provider activity', () => {
  const result = runProviderDisabledCoreJourney({ ...valid, completion: { ...valid.completion, activeCompletionHold: true } });
  assert.equal(result.completed, false);
  assert.equal(result.blocker, 'ACTIVE_COMPLETION_HOLD');
  assert.equal(result.realPaymentAttempted, false);
  assert.equal(result.externalProviderContacted, false);
});
