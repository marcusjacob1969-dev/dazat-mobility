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
  AUTOMATED_SAFETY_CLASSIFICATION_PROVES_DANGER_OR_MISCONDUCT,
  CALLER_ID_ALONE_AUTHENTICATES,
  FULL_CARD_DETAILS_AVAILABLE_TO_OPERATOR_OR_GENERAL_VOICE,
  TELEPHONE_PAYMENT_AUTHORIZES_PRIVATE_ACCOUNT_ACCESS,
  TELEPHONY_PROVIDER_CONFIGURED,
  VOICE_ASSISTANT_MAY_OVERRIDE_BACKEND_RULES,
  VOICE_ASSISTANT_PROVIDER_CONFIGURED,
  VOICE_BIOMETRIC_BASELINE_ENABLED,
  VOICE_BIOMETRIC_SOLE_HIGH_RISK_AUTHORITY,
  VOICE_RECOGNITION_IS_AUTHORITY,
  assessCallerAuthority,
  callResumeDecision,
  canTransitionVoiceDialogue,
  evaluateVoiceFieldCapture,
  humanHandoffDecision,
  recordingAndTranscriptMayBeUsed,
  telephoneBookingMayCommit,
  telephonePaymentDecision
} = await import('../../packages/domain/src/telephony-voice.ts');

test('caller ID alone never authenticates a claimed caller', () => {
  const result = assessCallerAuthority({
    claimedRole: 'BOOKER', requestedAction: 'READ_BOOKING_STATUS',
    verificationMethods: ['CALLER_ID_HINT'], confidence: 0.95, stepUpCompleted: false
  });
  assert.equal(result.actionAllowed, false);
  assert.equal(result.outcome, 'HUMAN_HANDOFF_REQUIRED');
  assert.equal(result.callerIdTreatedAsIdentityProof, false);
});

test('verified caller authority remains scoped', () => {
  const result = assessCallerAuthority({
    claimedRole: 'GUARDIAN', requestedAction: 'READ_BOOKING_STATUS',
    verificationMethods: ['AUTHORISED_GUARDIAN_RECORD'], confidence: 0.9, stepUpCompleted: false
  });
  assert.equal(result.outcome, 'VERIFIED_SCOPED');
  assert.equal(result.actionAllowed, true);
  assert.equal(result.disclosureMustRemainScoped, true);
});

test('high-risk changes fail closed without independent step-up', () => {
  const result = assessCallerAuthority({
    claimedRole: 'DRIVER', requestedAction: 'CHANGE_PAYOUT',
    verificationMethods: ['VERIFIED_CONTACT_CHALLENGE'], confidence: 0.9, stepUpCompleted: false
  });
  assert.equal(result.outcome, 'HIGH_RISK_VOICE_PROHIBITED');
  assert.equal(result.actionAllowed, false);
});

test('voice dialogue follows readback and backend-command stages without shortcut', () => {
  assert.equal(canTransitionVoiceDialogue('INTENT_DETECTED', 'BACKEND_COMMAND'), false);
  assert.equal(canTransitionVoiceDialogue('READBACK', 'CONFIRMATION'), true);
  assert.equal(canTransitionVoiceDialogue('CONFIRMATION', 'BACKEND_COMMAND'), true);
});

test('low-confidence critical field triggers targeted clarification', () => {
  const result = evaluateVoiceFieldCapture({
    field: 'PICKUP', source: 'SPEECH_RECOGNITION', confidence: 0.6,
    explicitReadbackCompleted: false, callerConfirmed: false, failedRecognitionCount: 1
  });
  assert.equal(result.usableForCommitment, false);
  assert.equal(result.nextAction, 'TARGETED_CLARIFICATION');
  assert.equal(result.transcriptTreatedAsAuthority, false);
});

test('critical voice field requires explicit readback and confirmation', () => {
  const result = evaluateVoiceFieldCapture({
    field: 'FINAL_PRICE', source: 'OPERATOR', confidence: 1,
    explicitReadbackCompleted: true, callerConfirmed: false, failedRecognitionCount: 0
  });
  assert.equal(result.usableForCommitment, false);
  assert.equal(result.nextAction, 'EXPLICIT_READBACK');
});

test('repeated recognition failure produces human handoff', () => {
  const result = evaluateVoiceFieldCapture({
    field: 'DESTINATION', source: 'SPEECH_RECOGNITION', confidence: 0.8,
    explicitReadbackCompleted: false, callerConfirmed: false, failedRecognitionCount: 3
  });
  assert.equal(result.nextAction, 'HUMAN_HANDOFF');
});

test('telephone booking cannot commit with ambiguity or missing confirmed fields', () => {
  const result = telephoneBookingMayCommit({
    canonicalBookingEngineUsed: true,
    pickupExplicitlyChosen: true,
    ambiguousLocationRemaining: true,
    criticalFieldsConfirmed: ['PICKUP', 'DESTINATION'],
    bookerPassengerPayerSeparated: true,
    quoteTermsConfirmed: false,
    capacityConfirmed: false,
    diagnosisStoredAsAccessibilityRequirement: false
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('LOCATION_CLARIFICATION_REQUIRED'));
  assert.ok(result.blockers.includes('FINAL_PRICE_CONFIRMATION_REQUIRED'));
  assert.equal(result.separateReducedFunctionSystemUsed, false);
});

test('complete readback can use the canonical Booking Engine', () => {
  const result = telephoneBookingMayCommit({
    canonicalBookingEngineUsed: true,
    pickupExplicitlyChosen: true,
    ambiguousLocationRemaining: false,
    criticalFieldsConfirmed: ['PICKUP', 'DESTINATION', 'DATE_TIME', 'PASSENGER_IDENTITY', 'ACCESSIBILITY_REQUIREMENTS', 'FINAL_PRICE'],
    bookerPassengerPayerSeparated: true,
    quoteTermsConfirmed: true,
    capacityConfirmed: true,
    diagnosisStoredAsAccessibilityRequirement: false
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.blockers, []);
});

test('safety handoff is warm and cannot be deferred to an ordinary callback', () => {
  const result = humanHandoffDecision({
    recognitionFailureCount: 0, lowConfidenceAddress: false, lowConfidencePassengerIdentity: false,
    safetyConcern: true, safeguardingConcern: false, suspectedAccountTakeover: false,
    paymentOrSecurityChange: false, callerDistressOrConfusion: false,
    unsupportedSpecialistRequest: false, personRequestedHuman: false
  });
  assert.equal(result.required, true);
  assert.equal(result.queue, 'SAFETY');
  assert.equal(result.warmContextRequired, true);
  assert.equal(result.callbackDeferralAllowed, false);
});

test('payment ambiguity requires reconciliation and never repeat collection', () => {
  const result = telephonePaymentDecision({
    rawCardDetailsCapturedByOperatorOrGeneralVoice: false,
    securePaymentLinkAvailable: true,
    tokenisedSavedMethodAvailable: false,
    pciCompliantIvrAvailable: false,
    providerStatus: 'STATUS_UNKNOWN',
    blindRepeatCollectionRequested: false
  });
  assert.equal(result.route, 'RECONCILIATION_REQUIRED');
  assert.equal(result.allowed, false);
  assert.equal(result.blindRepeatCollectionAllowed, false);
});

test('operator raw-card capture disables telephone payment', () => {
  const result = telephonePaymentDecision({
    rawCardDetailsCapturedByOperatorOrGeneralVoice: true,
    securePaymentLinkAvailable: false,
    tokenisedSavedMethodAvailable: false,
    pciCompliantIvrAvailable: false,
    providerStatus: 'NOT_STARTED',
    blindRepeatCollectionRequested: false
  });
  assert.equal(result.allowed, false);
  assert.equal(result.rawCardDetailsRetained, false);
});

test('dropped call resumes confirmed state without a duplicate booking', () => {
  const result = callResumeDecision({
    pendingInteractionFound: true,
    confirmedFieldsPreserved: true,
    idempotencyKeyReused: true,
    existingBookingId: '00000000-0000-4000-8000-000000000001'
  });
  assert.equal(result.resumeAllowed, true);
  assert.equal(result.createNewBookingAllowed, false);
  assert.equal(result.duplicateBookingRiskAccepted, false);
});

test('recording and transcript require purpose, legal basis, retention and restricted use', () => {
  const safe = {
    recordingPurposeDefined: true, legalBasisDefined: true, retentionPolicyDefined: true,
    accessPolicyDefined: true, transcriptTreatedAsAuthoritative: false, unrelatedModelTrainingRequested: false
  };
  assert.equal(recordingAndTranscriptMayBeUsed(safe), true);
  assert.equal(recordingAndTranscriptMayBeUsed({ ...safe, unrelatedModelTrainingRequested: true }), false);
  assert.equal(recordingAndTranscriptMayBeUsed({ ...safe, transcriptTreatedAsAuthoritative: true }), false);
});

test('telephone and voice hard boundaries remain disabled and non-authoritative', () => {
  assert.equal(TELEPHONY_PROVIDER_CONFIGURED, false);
  assert.equal(VOICE_ASSISTANT_PROVIDER_CONFIGURED, false);
  assert.equal(CALLER_ID_ALONE_AUTHENTICATES, false);
  assert.equal(VOICE_RECOGNITION_IS_AUTHORITY, false);
  assert.equal(VOICE_BIOMETRIC_BASELINE_ENABLED, false);
  assert.equal(VOICE_BIOMETRIC_SOLE_HIGH_RISK_AUTHORITY, false);
  assert.equal(FULL_CARD_DETAILS_AVAILABLE_TO_OPERATOR_OR_GENERAL_VOICE, false);
  assert.equal(TELEPHONE_PAYMENT_AUTHORIZES_PRIVATE_ACCOUNT_ACCESS, false);
  assert.equal(AUTOMATED_SAFETY_CLASSIFICATION_PROVES_DANGER_OR_MISCONDUCT, false);
  assert.equal(VOICE_ASSISTANT_MAY_OVERRIDE_BACKEND_RULES, false);
});
