import assert from 'node:assert/strict';
import test from 'node:test';
import { projectCoreJourneyProgress } from '../../services/api/dist/modules/core-journey/core-journey-service.js';

const row = (overrides = {}) => ({
  booking_id: '10000000-0000-4000-8000-000000000001',
  booking_status: 'CONFIRMED',
  fare_agreement_id: '10000000-0000-4000-8000-000000000002',
  dispatch_status: 'ASSIGNED',
  assignment_id: '10000000-0000-4000-8000-000000000003',
  journey_id: '10000000-0000-4000-8000-000000000004',
  journey_status: 'IN_PROGRESS',
  arrival_accepted: true,
  ridecheck_status: 'VERIFIED',
  payment_intent_status: null,
  ...overrides
});

test('connected projection identifies the first unfinished milestone', () => {
  const result = projectCoreJourneyProgress(row());
  assert.equal(result.nextAction, 'JOURNEY');
  assert.equal(result.productionChargingEnabled, false);
  assert.equal(result.milestones.find((item) => item.name === 'RIDECHECK').status, 'COMPLETED');
  assert.equal(result.milestones.find((item) => item.name === 'FINANCE').status, 'BLOCKED');
});

test('completed journey exposes provider-disabled finance as the next action', () => {
  const result = projectCoreJourneyProgress(row({ journey_status: 'COMPLETED', booking_status: 'COMPLETED' }));
  assert.equal(result.nextAction, 'FINANCE');
  assert.equal(result.milestones.find((item) => item.name === 'FINANCE').status, 'NOT_STARTED');
});

test('locked RideCheck remains an explicit blocker', () => {
  const result = projectCoreJourneyProgress(row({ ridecheck_status: 'LOCKED', journey_status: 'AWAITING_RIDECHECK' }));
  assert.equal(result.nextAction, 'RIDECHECK');
  assert.equal(result.milestones.find((item) => item.name === 'RIDECHECK').status, 'BLOCKED');
});

test('fully closed canonical journey has no invented follow-up action', () => {
  const result = projectCoreJourneyProgress(row({ journey_status: 'COMPLETED', booking_status: 'COMPLETED', payment_intent_status: 'CAPTURED' }));
  assert.equal(result.nextAction, 'JOURNEY_CLOSED');
  assert.equal(result.milestones.every((item) => item.status === 'COMPLETED'), true);
});
