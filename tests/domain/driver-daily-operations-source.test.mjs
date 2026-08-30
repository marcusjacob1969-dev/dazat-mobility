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
  BLIND_DRIVER_OFFERS_PERMITTED,
  DEMAND_FORECAST_GUARANTEES_EARNINGS,
  DRIVER_BREAK_IS_MISCONDUCT,
  DRIVER_FINISHING_SOON_IS_MISCONDUCT,
  ORDINARY_OFFLINE_APP_LOCATION_COLLECTION_PERMITTED,
  VOICE_INPUT_BYPASSES_BACKEND_VALIDATION,
  arrivalCommunicationPlanIsSafe,
  assessDriverConnectivity,
  evaluateDriverOfferDisclosure,
  evaluateDriverSupportRouting,
  homewardPreferenceMayInfluenceRanking,
  queuedCriticalEventSubmissionRoute,
  supplySignalMayBePublished
} = await import('../../packages/domain/src/driver-daily-operations.ts');

test('an offer fails closed when ETA and independent Driver earning disclosure are absent', () => {
  const decision = evaluateDriverOfferDisclosure({
    pickupDistanceMetres: 1_200,
    pickupEtaMinutes: null,
    serviceCodes: ['STANDARD'],
    journeyContextLabels: ['ON_DEMAND'],
    expectedEarningAmountMinor: null,
    expectedEarningCurrency: null,
    expectedEarningPolicyVersion: null,
    expectedEarningDerivedFromRiderFare: false,
    ordinaryDeclinePenaltyApplied: false
  });
  assert.equal(decision.informedChoiceReady, false);
  assert.equal(decision.acceptanceAllowed, false);
  assert.deepEqual(decision.missingDisclosures, ['PICKUP_ETA', 'EXPECTED_OR_ESTIMATED_EARNING']);
});

test('a complete informed offer can be actioned without a decline penalty', () => {
  const decision = evaluateDriverOfferDisclosure({
    pickupDistanceMetres: 1_200,
    pickupEtaMinutes: 6,
    serviceCodes: ['WAV'],
    journeyContextLabels: ['SCHEDULED', 'WHEELCHAIR'],
    expectedEarningAmountMinor: 1_450,
    expectedEarningCurrency: 'GBP',
    expectedEarningPolicyVersion: 'driver-earning-policy-v1',
    expectedEarningDerivedFromRiderFare: false,
    ordinaryDeclinePenaltyApplied: false
  });
  assert.equal(decision.informedChoiceReady, true);
  assert.equal(decision.acceptanceAllowed, true);
  assert.equal(decision.ordinaryDeclinePenaltyApplied, false);
});

test('reusing the Rider fare as the Driver earning never satisfies informed choice', () => {
  const decision = evaluateDriverOfferDisclosure({
    pickupDistanceMetres: 900,
    pickupEtaMinutes: 4,
    serviceCodes: ['STANDARD'],
    journeyContextLabels: ['ON_DEMAND'],
    expectedEarningAmountMinor: 900,
    expectedEarningCurrency: 'GBP',
    expectedEarningPolicyVersion: 'rider-fare-copy',
    expectedEarningDerivedFromRiderFare: true,
    ordinaryDeclinePenaltyApplied: false
  });
  assert.equal(decision.acceptanceAllowed, false);
  assert.ok(decision.missingDisclosures.includes('INDEPENDENT_DRIVER_EARNING_BASIS'));
});

test('weak-signal reconciliation never executes queued critical events', () => {
  const assessment = assessDriverConnectivity({
    networkReachable: true,
    lastServerSyncAt: new Date('2030-01-01T00:00:00Z'),
    now: new Date('2030-01-01T00:00:10Z'),
    maximumFreshAgeMs: 60_000,
    authoritativeSnapshotApplied: true,
    queuedCriticalEventCount: 2
  });
  assert.equal(assessment.state, 'DEGRADED');
  assert.equal(assessment.queuedCriticalEventsExecutedByReconciliation, false);
  assert.equal(assessment.speculativeStateMayBeTrusted, false);
});

test('a reconnect without matching authoritative state requires replacement', () => {
  const assessment = assessDriverConnectivity({
    networkReachable: true,
    lastServerSyncAt: new Date('2030-01-01T00:00:00Z'),
    now: new Date('2030-01-01T00:00:01Z'),
    maximumFreshAgeMs: 60_000,
    authoritativeSnapshotApplied: false,
    queuedCriticalEventCount: 0
  });
  assert.equal(assessment.state, 'RECOVERING');
  assert.equal(assessment.authoritativeSnapshotRequired, true);
});

test('queued Safety and location events retain canonical submission routes', () => {
  assert.equal(queuedCriticalEventSubmissionRoute('SOS'), 'CANONICAL_SAFETY_COMMAND');
  assert.equal(queuedCriticalEventSubmissionRoute('RIDER_CONDUCT'), 'CANONICAL_RIDER_CONDUCT_COMMAND');
  assert.equal(queuedCriticalEventSubmissionRoute('LOCATION_OBSERVATION'), 'AUTHORITATIVE_LOCATION_OBSERVATION_COMMAND');
});

test('high-risk active Driver Support requires human escalation without pretending external contact', () => {
  const result = evaluateDriverSupportRouting({
    category: 'BREAKDOWN', activeJourney: true, immediateDanger: false, serviceContinuityAtRisk: true
  });
  assert.equal(result.risk, 'HIGH_RISK_ACTIVE');
  assert.equal(result.humanEscalationRequired, true);
  assert.equal(result.externalServiceContacted, false);
});

test('supply signals require evidence and cannot guarantee earnings', () => {
  assert.equal(supplySignalMayBePublished({
    kind: 'FORECAST', observedOrForecastAt: new Date('2030-01-01T00:00:00Z'),
    evidenceReferences: ['forecast-model-run'], capabilityCode: 'WAV', guaranteedEarningsClaim: false
  }), true);
  assert.equal(supplySignalMayBePublished({
    kind: 'FORECAST', observedOrForecastAt: new Date('2030-01-01T00:00:00Z'),
    evidenceReferences: ['forecast-model-run'], capabilityCode: 'WAV', guaranteedEarningsClaim: true
  }), false);
});

test('homeward preference is subordinate to hard eligibility and cannot use passenger attributes', () => {
  const safe = {
    driverFinishingSoon: true, hardEligibilityPassed: true, passengerAttributeUsed: false,
    guaranteedTripClaimed: false, preferenceExpired: false
  };
  assert.equal(homewardPreferenceMayInfluenceRanking(safe), true);
  assert.equal(homewardPreferenceMayInfluenceRanking({ ...safe, passengerAttributeUsed: true }), false);
  assert.equal(homewardPreferenceMayInfluenceRanking({ ...safe, hardEligibilityPassed: false }), false);
});

test('arrival communication uses the chosen Booking pickup and protects contact details', () => {
  assert.equal(arrivalCommunicationPlanIsSafe({
    authoritativeBookingPickupUsed: true,
    passengerGpsAssumedAsPickup: false,
    recipientRolesScoped: true,
    directContactDetailsExposed: false
  }), true);
  assert.equal(arrivalCommunicationPlanIsSafe({
    authoritativeBookingPickupUsed: false,
    passengerGpsAssumedAsPickup: true,
    recipientRolesScoped: true,
    directContactDetailsExposed: false
  }), false);
});

test('daily-operation policy constants keep break, offline, voice, blind offers and forecasts safe', () => {
  assert.equal(BLIND_DRIVER_OFFERS_PERMITTED, false);
  assert.equal(ORDINARY_OFFLINE_APP_LOCATION_COLLECTION_PERMITTED, false);
  assert.equal(DEMAND_FORECAST_GUARANTEES_EARNINGS, false);
  assert.equal(VOICE_INPUT_BYPASSES_BACKEND_VALIDATION, false);
  assert.equal(DRIVER_BREAK_IS_MISCONDUCT, false);
  assert.equal(DRIVER_FINISHING_SOON_IS_MISCONDUCT, false);
});
