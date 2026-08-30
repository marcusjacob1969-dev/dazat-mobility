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
  INCENTIVE_MAY_PRESSURE_UNSAFE_FATIGUE,
  OFFBOARDING_MAY_ERASE_HISTORICAL_TRUTH,
  OPAQUE_DRIVER_SCORE_USED,
  ORDINARY_OFFER_DECLINE_CHANGES_DISPATCH_PRIORITY,
  ORDINARY_OFFER_DECLINE_IS_MISCONDUCT,
  RIDER_RATING_IS_CONDUCT_FINDING,
  SAFE_JOURNEY_TERMINATION_MAY_HARM_RATING,
  TEMPORARY_RESTRICTION_IS_GUILT,
  canTransitionDriverComplaint,
  complaintFindingMayBeRecorded,
  driverMayEnterBreakAfterUnsafeTermination,
  driverIncentiveMayBePublished,
  evaluateOfferOutcomeFairness,
  evaluateRatingFeedback,
  evaluateReliabilityAttribution,
  highImpactAppealMayBeResolved,
  offboardingHistoryIsPreserved,
  precautionaryRestrictionMayBeApplied,
  unsafeJourneyTerminationMayProceed
} = await import('../../packages/domain/src/driver-fair-treatment.ts');

test('rating is accepted as feedback without becoming a finding or priority input', () => {
  const decision = evaluateRatingFeedback(4);
  assert.equal(decision.acceptedAsFeedback, true);
  assert.equal(decision.conductFindingCreated, false);
  assert.equal(decision.driverRestrictionCreated, false);
  assert.equal(decision.dispatchPriorityChanged, false);
  assert.throws(() => evaluateRatingFeedback(6), /one to five/);
});

test('complaint lifecycle cannot skip Driver response and assessment stages', () => {
  assert.equal(canTransitionDriverComplaint('ALLEGATION_RECORDED', 'DRIVER_RESPONSE_PENDING'), true);
  assert.equal(canTransitionDriverComplaint('ALLEGATION_RECORDED', 'FINDING_RECORDED'), false);
  assert.equal(canTransitionDriverComplaint('ASSESSMENT_PENDING', 'FINDING_RECORDED'), true);
});

test('a rating alone can never satisfy the finding gate', () => {
  assert.equal(complaintFindingMayBeRecorded({
    responseOpportunityProvided: true,
    assessmentPresent: true,
    evidenceReferences: ['journey-evidence'],
    authorisedIndependentReviewer: true,
    ratingOnly: true
  }), false);
  assert.equal(complaintFindingMayBeRecorded({
    responseOpportunityProvided: true,
    assessmentPresent: true,
    evidenceReferences: ['journey-evidence'],
    authorisedIndependentReviewer: true,
    ratingOnly: false
  }), true);
});

test('every offer outcome remains exact and non-punitive by itself', () => {
  for (const outcome of ['ACCEPTED', 'DECLINED', 'TIMED_OUT', 'TECHNICAL_FAILURE', 'WITHDRAWN', 'DRIVER_BECAME_INELIGIBLE', 'ASSIGNED_ELSEWHERE']) {
    const decision = evaluateOfferOutcomeFairness(outcome);
    assert.equal(decision.outcome, outcome);
    assert.equal(decision.automaticallyCreatesMisconduct, false);
    assert.equal(decision.acceptanceRatePenaltyApplied, false);
    assert.equal(decision.dispatchPriorityPenaltyApplied, false);
  }
});

test('reliability attribution requires an accepted commitment, Driver cause and evidence', () => {
  assert.equal(evaluateReliabilityAttribution({
    acceptedCommitment: false, cause: 'DRIVER', evidenceReferences: ['evidence']
  }).reliabilityConcernSupported, false);
  assert.equal(evaluateReliabilityAttribution({
    acceptedCommitment: true, cause: 'SYSTEM', evidenceReferences: ['platform-outage']
  }).reliabilityConcernSupported, false);
  const supported = evaluateReliabilityAttribution({
    acceptedCommitment: true, cause: 'DRIVER', evidenceReferences: ['accepted-schedule', 'timeline']
  });
  assert.equal(supported.reliabilityConcernSupported, true);
  assert.equal(supported.createsMisconductFinding, false);
});

test('precautionary restriction requires evidence, review and narrowest safe scope', () => {
  assert.equal(precautionaryRestrictionMayBeApplied({
    evidenceReferences: ['safety-event'], narrowestSafeScope: true,
    reviewDueAt: new Date('2030-01-01T00:00:00Z'), guiltFindingCreated: false
  }), true);
  assert.equal(precautionaryRestrictionMayBeApplied({
    evidenceReferences: ['safety-event'], narrowestSafeScope: false,
    reviewDueAt: new Date('2030-01-01T00:00:00Z'), guiltFindingCreated: false
  }), false);
});

test('high-impact appeal resolution requires independent evidence-backed review', () => {
  assert.equal(highImpactAppealMayBeResolved({
    evidenceReferences: ['original-record', 'appeal-evidence'],
    independentFromOriginalDecision: true,
    reviewerIsDriver: false,
    originalDecisionHistoryPreserved: true
  }), true);
  assert.equal(highImpactAppealMayBeResolved({
    evidenceReferences: ['appeal-evidence'],
    independentFromOriginalDecision: false,
    reviewerIsDriver: false,
    originalDecisionHistoryPreserved: true
  }), false);
});

test('unsafe Journey termination needs assigned-Driver authority and canonical Safety records', () => {
  assert.equal(unsafeJourneyTerminationMayProceed({
    actorIsAssignedDriver: true, journeyStatus: 'IN_PROGRESS',
    riderConductCasePersisted: true, canonicalSafetyEventPersisted: true
  }), true);
  assert.equal(unsafeJourneyTerminationMayProceed({
    actorIsAssignedDriver: false, journeyStatus: 'IN_PROGRESS',
    riderConductCasePersisted: true, canonicalSafetyEventPersisted: true
  }), false);
  assert.equal(unsafeJourneyTerminationMayProceed({
    actorIsAssignedDriver: true, journeyStatus: 'COMPLETED',
    riderConductCasePersisted: true, canonicalSafetyEventPersisted: true
  }), false);
  assert.equal(driverMayEnterBreakAfterUnsafeTermination({
    fromAvailability: 'ASSIGNED', assignmentCancelled: true,
    safetyTerminationPersisted: true, passengerContinuityOpened: true
  }), true);
  assert.equal(driverMayEnterBreakAfterUnsafeTermination({
    fromAvailability: 'AVAILABLE', assignmentCancelled: true,
    safetyTerminationPersisted: true, passengerContinuityOpened: true
  }), false);
});

test('incentives reject fatigue pressure, acceptance coercion and hidden priority boosts', () => {
  const valid = {
    versionedRules: true,
    visibleTerms: ['Complete specified accessible-service training'],
    financeApproved: true,
    evidenceReferences: ['finance-approval'],
    baseEarningSeparate: true,
    acceptanceCoercionAllowed: false,
    fatiguePressureAllowed: false,
    secretDispatchPriorityBoostAllowed: false
  };
  assert.equal(driverIncentiveMayBePublished(valid), true);
  assert.equal(driverIncentiveMayBePublished({ ...valid, fatiguePressureAllowed: true }), false);
  assert.equal(driverIncentiveMayBePublished({ ...valid, acceptanceCoercionAllowed: true }), false);
  assert.equal(driverIncentiveMayBePublished({ ...valid, secretDispatchPriorityBoostAllowed: true }), false);
});

test('offboarding preserves every financial, dispute, vehicle and Safety obligation', () => {
  const preserved = {
    earningsPreserved: true,
    disputesPreserved: true,
    vehicleReturnObligationsPreserved: true,
    safetyHistoryPreserved: true,
    financialHistoryPreserved: true
  };
  assert.equal(offboardingHistoryIsPreserved(preserved), true);
  assert.equal(offboardingHistoryIsPreserved({ ...preserved, disputesPreserved: false }), false);
  assert.equal(OPAQUE_DRIVER_SCORE_USED, false);
  assert.equal(RIDER_RATING_IS_CONDUCT_FINDING, false);
  assert.equal(ORDINARY_OFFER_DECLINE_IS_MISCONDUCT, false);
  assert.equal(ORDINARY_OFFER_DECLINE_CHANGES_DISPATCH_PRIORITY, false);
  assert.equal(TEMPORARY_RESTRICTION_IS_GUILT, false);
  assert.equal(SAFE_JOURNEY_TERMINATION_MAY_HARM_RATING, false);
  assert.equal(INCENTIVE_MAY_PRESSURE_UNSAFE_FATIGUE, false);
  assert.equal(OFFBOARDING_MAY_ERASE_HISTORICAL_TRUTH, false);
});
