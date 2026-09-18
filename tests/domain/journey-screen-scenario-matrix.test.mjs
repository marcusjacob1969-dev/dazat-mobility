import assert from 'node:assert/strict';
import { presentCoreJourneyForSurface } from '../../packages/design-system/dist/index.js';

const semantics = [
  ['SUPPORT_REQUIRED', 'SUPPORT_REQUIRED', 'danger'],
  ['PAYMENT_PROVIDER_UNAVAILABLE', 'PAYMENT_PROVIDER_UNAVAILABLE', 'warning'],
  ['JOURNEY_CLOSED', 'COMPLETED', 'positive'],
  ['RIDE_CHECK_REQUIRED', 'PICKUP_PROTECTED', 'warning'],
  ['START_JOURNEY', 'PICKUP_PROTECTED', 'positive'],
  ['DRIVER_ASSIGNMENT_REQUIRED', 'DISPATCHING', 'neutral'],
  ['DRIVER_EN_ROUTE', 'DRIVER_ASSIGNED', 'positive'],
  ['JOURNEY_IN_PROGRESS', 'IN_JOURNEY', 'positive']
];

for (const [nextAction, expectedPhase, expectedTone] of semantics) {
  const presentations = ['RIDER', 'DRIVER', 'CONTROL_ROOM'].map((surface) => presentCoreJourneyForSurface({ surface, nextAction }));
  assert.deepEqual(presentations.map((item) => item.phase), [expectedPhase, expectedPhase, expectedPhase], `${nextAction} phase must be identical across surfaces`);
  assert.deepEqual(presentations.map((item) => item.tone), [expectedTone, expectedTone, expectedTone], `${nextAction} tone must be identical across surfaces`);
  assert.ok(presentations.every((item) => item.label.length > 0), `${nextAction} needs a visible label`);
  assert.ok(presentations.every((item) => item.operationalHint.length > 0), `${nextAction} needs an operational hint`);
}

const rider = presentCoreJourneyForSurface({ surface: 'RIDER', nextAction: 'JOURNEY_IN_PROGRESS' });
const driver = presentCoreJourneyForSurface({ surface: 'DRIVER', nextAction: 'JOURNEY_IN_PROGRESS' });
const controlRoom = presentCoreJourneyForSurface({ surface: 'CONTROL_ROOM', nextAction: 'JOURNEY_IN_PROGRESS' });
assert.notEqual(rider.operationalHint, driver.operationalHint);
assert.notEqual(driver.operationalHint, controlRoom.operationalHint);
assert.equal(rider.phase, driver.phase);
assert.equal(driver.phase, controlRoom.phase);

console.log('Phase 0.105 core Journey screen scenario matrix PASSED');
