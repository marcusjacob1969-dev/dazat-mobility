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
  ROUTE_CONCERN_IS_AUTOMATIC_MISCONDUCT_FINDING,
  evaluateDestinationEvidence,
  evaluateJourneyCompletion,
  evaluateMovementPlausibility,
  healthForSafetySignal,
  routeConcernSeverity,
  silentAssistancePolicy
} = await import('../../packages/domain/src/live-journey.ts');
const { canTransitionJourney } = await import('../../packages/domain/src/journey.ts');
const { canReleaseDriverAfterJourneyCompletion, canTransitionDriverAvailability } = await import('../../packages/domain/src/dispatch.ts');

const earlier = { latitude: 53.4808, longitude: -2.2426, observedAt: new Date('2026-08-29T12:00:00.000Z') };

test('active Journey movement accepts plausible progress and rejects impossible or out-of-order evidence', () => {
  const plausible = evaluateMovementPlausibility(earlier, {
    latitude: 53.4810, longitude: -2.2426, observedAt: new Date('2026-08-29T12:00:10.000Z')
  }, 75);
  assert.equal(plausible.plausible, true);
  assert.ok(plausible.impliedSpeedMetresPerSecond < 75);

  const jump = evaluateMovementPlausibility(earlier, {
    latitude: 53.5808, longitude: -2.2426, observedAt: new Date('2026-08-29T12:00:05.000Z')
  }, 75);
  assert.equal(jump.plausible, false);
  assert.equal(jump.blocker, 'IMPOSSIBLE_JUMP');

  const outOfOrder = evaluateMovementPlausibility(earlier, {
    latitude: 53.4809, longitude: -2.2426, observedAt: new Date('2026-08-29T11:59:59.000Z')
  }, 75);
  assert.equal(outOfOrder.plausible, false);
  assert.equal(outOfOrder.blocker, 'OUT_OF_ORDER_LOCATION');
});

test('destination arrival requires fresh confident telemetry inside the governed radius', () => {
  const decision = evaluateDestinationEvidence({
    latitude: 53.4808,
    longitude: -2.2426,
    observedAt: new Date('2026-08-29T11:59:45.000Z'),
    receivedAt: new Date('2026-08-29T12:00:00.000Z'),
    accuracyMetres: 20,
    confidence: 0.95
  }, { latitude: 53.48081, longitude: -2.24259 }, {
    maxAgeSeconds: 60,
    maximumFutureSkewSeconds: 15,
    maximumAccuracyMetres: 75,
    minimumConfidence: 0.7,
    destinationRadiusMetres: 250
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.withinRadius, true);
});

test('completion passes only from ARRIVING with active assignment and accepted destination evidence', () => {
  const standard = {
    journeyStatus: 'ARRIVING',
    bookingStatus: 'ARRIVING',
    assignmentActive: true,
    destinationEvidenceAccepted: true,
    activeCompletionHold: false,
    continuityCaseOpen: false,
    handoverRequired: false,
    authorisedHandoverRecorded: false,
    handoverFailureOpen: false
  };
  assert.deepEqual(evaluateJourneyCompletion(standard), { allowed: true, blockers: [] });
  assert.deepEqual(evaluateJourneyCompletion({ ...standard, journeyStatus: 'IN_PROGRESS' }).blockers, ['NOT_ARRIVING']);
  assert.deepEqual(evaluateJourneyCompletion({ ...standard, activeCompletionHold: true }).blockers, ['ACTIVE_COMPLETION_HOLD']);
});

test('required or failed handover blocks completion until authorised evidence exists', () => {
  const handover = {
    journeyStatus: 'ARRIVING', bookingStatus: 'ARRIVING', assignmentActive: true,
    destinationEvidenceAccepted: true, activeCompletionHold: false, continuityCaseOpen: false,
    handoverRequired: true, authorisedHandoverRecorded: false, handoverFailureOpen: false
  };
  assert.deepEqual(evaluateJourneyCompletion(handover).blockers, ['HANDOVER_REQUIRED']);
  assert.deepEqual(evaluateJourneyCompletion({ ...handover, handoverFailureOpen: true }).blockers,
    ['HANDOVER_FAILURE_OPEN', 'HANDOVER_REQUIRED']);
  assert.equal(evaluateJourneyCompletion({ ...handover, authorisedHandoverRecorded: true }).allowed, true);
});

test('Safety semantics preserve silent assistance and contextual route concern boundaries', () => {
  assert.deepEqual(silentAssistancePolicy(), {
    doNotAutoCallReporter: true,
    externalDeliveryRequiredForPersistence: false
  });
  assert.equal(healthForSafetySignal('SOS'), 'INCIDENT');
  assert.equal(healthForSafetySignal('SILENT_ASSISTANCE'), 'AT_RISK');
  assert.equal(routeConcernSeverity('CHECK_ROUTE'), 'MODERATE');
  assert.equal(routeConcernSeverity('WRONG_DESTINATION'), 'SIGNIFICANT');
  assert.equal(routeConcernSeverity('FEEL_UNSAFE'), 'CRITICAL');
  assert.equal(ROUTE_CONCERN_IS_AUTOMATIC_MISCONDUCT_FINDING, false);
});

test('governed completion closes Journey and releases Driver without opening an ordinary shortcut', () => {
  assert.equal(canTransitionJourney('IN_PROGRESS', 'ARRIVING'), true);
  assert.equal(canTransitionJourney('ARRIVING', 'COMPLETED'), true);
  assert.equal(canTransitionJourney('IN_PROGRESS', 'COMPLETED'), false);
  assert.equal(canTransitionDriverAvailability('ASSIGNED', 'AVAILABLE'), false);
  assert.equal(canTransitionDriverAvailability('ASSIGNED', 'OFFLINE'), false);
  assert.equal(canReleaseDriverAfterJourneyCompletion({
    from: 'ASSIGNED', to: 'AVAILABLE', journeyCompleted: true, assignmentCompleted: true
  }), true);
  assert.equal(canReleaseDriverAfterJourneyCompletion({
    from: 'ASSIGNED', to: 'AVAILABLE', journeyCompleted: false, assignmentCompleted: true
  }), false);
});
