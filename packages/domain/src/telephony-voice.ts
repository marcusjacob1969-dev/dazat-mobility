export const CALLER_ROLES = [
  'BOOKER', 'PASSENGER', 'PAYER', 'GUARDIAN', 'CARER', 'SCHOOL_CONTACT',
  'BUSINESS_CONTACT', 'DRIVER', 'RESCUE_PROVIDER', 'UNKNOWN'
] as const;
export type CallerRole = (typeof CALLER_ROLES)[number];

export const CALLER_ACTIONS = [
  'CREATE_BOOKING', 'READ_BOOKING_STATUS', 'CHANGE_BOOKING', 'CANCEL_BOOKING',
  'REQUEST_SUPPORT', 'REPORT_SAFETY', 'ACCOUNT_RECOVERY', 'CHANGE_PAYOUT',
  'CHANGE_STORED_PAYMENT', 'READ_SENSITIVE_PROFILE'
] as const;
export type CallerAction = (typeof CALLER_ACTIONS)[number];

export const CALLER_VERIFICATION_METHODS = [
  'CALLER_ID_HINT', 'VERIFIED_CONTACT_CHALLENGE', 'IN_APP_STEP_UP', 'OPERATOR_EVIDENCE',
  'AUTHORISED_GUARDIAN_RECORD', 'ORGANISATION_AUTHORITY', 'VERIFIED_SUPPLIER_CONTACT'
] as const;
export type CallerVerificationMethod = (typeof CALLER_VERIFICATION_METHODS)[number];

export const CALL_QUEUES = [
  'SAFETY', 'SCHOOL_SAFEGUARDING', 'ACTIVE_JOURNEY', 'BREAKDOWN', 'TELEPHONE_BOOKING',
  'ACCESSIBILITY_ASSISTED', 'DRIVER', 'PAYMENT', 'ACCOUNT_SECURITY', 'ROUTINE_SUPPORT'
] as const;
export type CallQueue = (typeof CALL_QUEUES)[number];

export const VOICE_DIALOGUE_STATES = [
  'INTENT_DETECTED', 'REQUIRED_FIELDS_COLLECTION', 'READBACK', 'CONFIRMATION',
  'BACKEND_COMMAND', 'RESULT', 'HUMAN_HANDOFF', 'ABANDONED'
] as const;
export type VoiceDialogueState = (typeof VOICE_DIALOGUE_STATES)[number];

export const VOICE_CRITICAL_FIELDS = [
  'PICKUP', 'DESTINATION', 'DATE_TIME', 'PASSENGER_IDENTITY',
  'ACCESSIBILITY_REQUIREMENTS', 'FINAL_PRICE'
] as const;
export type VoiceCriticalField = (typeof VOICE_CRITICAL_FIELDS)[number];

const highRiskActions: readonly CallerAction[] = [
  'ACCOUNT_RECOVERY', 'CHANGE_PAYOUT', 'CHANGE_STORED_PAYMENT', 'READ_SENSITIVE_PROFILE'
];
const independentVerificationMethods: readonly CallerVerificationMethod[] = [
  'VERIFIED_CONTACT_CHALLENGE', 'IN_APP_STEP_UP', 'OPERATOR_EVIDENCE',
  'AUTHORISED_GUARDIAN_RECORD', 'ORGANISATION_AUTHORITY', 'VERIFIED_SUPPLIER_CONTACT'
];

export function assessCallerAuthority(input: {
  readonly claimedRole: CallerRole;
  readonly requestedAction: CallerAction;
  readonly verificationMethods: readonly CallerVerificationMethod[];
  readonly confidence: number;
  readonly stepUpCompleted: boolean;
}): {
  readonly outcome: 'VERIFIED_SCOPED' | 'CLARIFICATION_REQUIRED' | 'HUMAN_HANDOFF_REQUIRED' | 'HIGH_RISK_VOICE_PROHIBITED';
  readonly actionAllowed: boolean;
  readonly callerIdTreatedAsIdentityProof: false;
  readonly disclosureMustRemainScoped: true;
} {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error('Caller identity confidence must be between zero and one');
  }
  if (input.claimedRole === 'UNKNOWN' || input.confidence < 0.5) {
    return callerAuthority('CLARIFICATION_REQUIRED', false);
  }
  const independentlyVerified = input.verificationMethods.some((method) => independentVerificationMethods.includes(method));
  if (!independentlyVerified) return callerAuthority('HUMAN_HANDOFF_REQUIRED', false);
  if (highRiskActions.includes(input.requestedAction) && !input.stepUpCompleted) {
    return callerAuthority('HIGH_RISK_VOICE_PROHIBITED', false);
  }
  return callerAuthority('VERIFIED_SCOPED', true);
}

function callerAuthority(
  outcome: ReturnType<typeof assessCallerAuthority>['outcome'],
  actionAllowed: boolean
): ReturnType<typeof assessCallerAuthority> {
  return { outcome, actionAllowed, callerIdTreatedAsIdentityProof: false, disclosureMustRemainScoped: true };
}

export function canTransitionVoiceDialogue(from: VoiceDialogueState, to: VoiceDialogueState): boolean {
  const transitions: Readonly<Record<VoiceDialogueState, readonly VoiceDialogueState[]>> = {
    INTENT_DETECTED: ['REQUIRED_FIELDS_COLLECTION', 'HUMAN_HANDOFF', 'ABANDONED'],
    REQUIRED_FIELDS_COLLECTION: ['READBACK', 'HUMAN_HANDOFF', 'ABANDONED'],
    READBACK: ['CONFIRMATION', 'REQUIRED_FIELDS_COLLECTION', 'HUMAN_HANDOFF', 'ABANDONED'],
    CONFIRMATION: ['BACKEND_COMMAND', 'REQUIRED_FIELDS_COLLECTION', 'HUMAN_HANDOFF', 'ABANDONED'],
    BACKEND_COMMAND: ['RESULT', 'HUMAN_HANDOFF'],
    RESULT: [],
    HUMAN_HANDOFF: [],
    ABANDONED: []
  };
  return transitions[from].includes(to);
}

export function evaluateVoiceFieldCapture(input: {
  readonly field: VoiceCriticalField | string;
  readonly source: 'SPEECH_RECOGNITION' | 'DTMF' | 'OPERATOR' | 'SAVED_VERIFIED_PROFILE';
  readonly confidence: number;
  readonly explicitReadbackCompleted: boolean;
  readonly callerConfirmed: boolean;
  readonly failedRecognitionCount: number;
}): {
  readonly usableForCommitment: boolean;
  readonly nextAction: 'ACCEPT_CAPTURE' | 'TARGETED_CLARIFICATION' | 'EXPLICIT_READBACK' | 'HUMAN_HANDOFF';
  readonly transcriptTreatedAsAuthority: false;
} {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error('Voice field confidence must be between zero and one');
  }
  if (!Number.isSafeInteger(input.failedRecognitionCount) || input.failedRecognitionCount < 0) {
    throw new Error('Recognition failure count must be a non-negative safe integer');
  }
  if (input.failedRecognitionCount >= 3) return fieldDecision(false, 'HUMAN_HANDOFF');
  if (input.confidence < 0.75) return fieldDecision(false, 'TARGETED_CLARIFICATION');
  const critical = (VOICE_CRITICAL_FIELDS as readonly string[]).includes(input.field);
  if (critical && (!input.explicitReadbackCompleted || !input.callerConfirmed)) {
    return fieldDecision(false, 'EXPLICIT_READBACK');
  }
  return fieldDecision(true, 'ACCEPT_CAPTURE');
}

function fieldDecision(
  usableForCommitment: boolean,
  nextAction: ReturnType<typeof evaluateVoiceFieldCapture>['nextAction']
): ReturnType<typeof evaluateVoiceFieldCapture> {
  return { usableForCommitment, nextAction, transcriptTreatedAsAuthority: false };
}

export function telephoneBookingMayCommit(input: {
  readonly canonicalBookingEngineUsed: boolean;
  readonly pickupExplicitlyChosen: boolean;
  readonly ambiguousLocationRemaining: boolean;
  readonly criticalFieldsConfirmed: readonly VoiceCriticalField[];
  readonly bookerPassengerPayerSeparated: boolean;
  readonly quoteTermsConfirmed: boolean;
  readonly capacityConfirmed: boolean;
  readonly diagnosisStoredAsAccessibilityRequirement: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly separateReducedFunctionSystemUsed: false } {
  const blockers: string[] = [];
  if (!input.canonicalBookingEngineUsed) blockers.push('CANONICAL_BOOKING_ENGINE_REQUIRED');
  if (!input.pickupExplicitlyChosen) blockers.push('PICKUP_CONFIRMATION_REQUIRED');
  if (input.ambiguousLocationRemaining) blockers.push('LOCATION_CLARIFICATION_REQUIRED');
  for (const field of VOICE_CRITICAL_FIELDS) {
    if (!input.criticalFieldsConfirmed.includes(field)) blockers.push(`${field}_CONFIRMATION_REQUIRED`);
  }
  if (!input.bookerPassengerPayerSeparated) blockers.push('PARTY_ROLE_SEPARATION_REQUIRED');
  if (!input.quoteTermsConfirmed) blockers.push('QUOTE_TERMS_CONFIRMATION_REQUIRED');
  if (!input.capacityConfirmed) blockers.push('CAPACITY_CONFIRMATION_REQUIRED');
  if (input.diagnosisStoredAsAccessibilityRequirement) blockers.push('OPERATIONAL_ACCESSIBILITY_REQUIREMENTS_ONLY');
  return { allowed: blockers.length === 0, blockers, separateReducedFunctionSystemUsed: false };
}

export function humanHandoffDecision(input: {
  readonly recognitionFailureCount: number;
  readonly lowConfidenceAddress: boolean;
  readonly lowConfidencePassengerIdentity: boolean;
  readonly safetyConcern: boolean;
  readonly safeguardingConcern: boolean;
  readonly suspectedAccountTakeover: boolean;
  readonly paymentOrSecurityChange: boolean;
  readonly callerDistressOrConfusion: boolean;
  readonly unsupportedSpecialistRequest: boolean;
  readonly personRequestedHuman: boolean;
}): { readonly required: boolean; readonly queue: CallQueue; readonly warmContextRequired: boolean; readonly callbackDeferralAllowed: boolean } {
  const safety = input.safetyConcern;
  const safeguarding = input.safeguardingConcern;
  const accountSecurity = input.suspectedAccountTakeover || input.paymentOrSecurityChange;
  const required = input.personRequestedHuman
    || input.recognitionFailureCount >= 3
    || input.lowConfidenceAddress
    || input.lowConfidencePassengerIdentity
    || safety
    || safeguarding
    || accountSecurity
    || input.callerDistressOrConfusion
    || input.unsupportedSpecialistRequest;
  const queue: CallQueue = safety ? 'SAFETY'
    : safeguarding ? 'SCHOOL_SAFEGUARDING'
      : accountSecurity ? 'ACCOUNT_SECURITY'
        : input.lowConfidenceAddress || input.lowConfidencePassengerIdentity ? 'TELEPHONE_BOOKING'
          : 'ROUTINE_SUPPORT';
  return { required, queue, warmContextRequired: required, callbackDeferralAllowed: !safety && !safeguarding };
}

export function telephonePaymentDecision(input: {
  readonly rawCardDetailsCapturedByOperatorOrGeneralVoice: boolean;
  readonly securePaymentLinkAvailable: boolean;
  readonly tokenisedSavedMethodAvailable: boolean;
  readonly pciCompliantIvrAvailable: boolean;
  readonly providerStatus: 'NOT_STARTED' | 'SUCCEEDED' | 'FAILED' | 'STATUS_UNKNOWN';
  readonly blindRepeatCollectionRequested: boolean;
}): {
  readonly route: 'SECURE_PAYMENT_LINK' | 'TOKENISED_SAVED_METHOD' | 'PCI_IVR' | 'UNAVAILABLE' | 'RECONCILIATION_REQUIRED';
  readonly allowed: boolean;
  readonly rawCardDetailsRetained: false;
  readonly blindRepeatCollectionAllowed: false;
} {
  if (input.rawCardDetailsCapturedByOperatorOrGeneralVoice || input.blindRepeatCollectionRequested) {
    return paymentDecision('UNAVAILABLE', false);
  }
  if (input.providerStatus === 'STATUS_UNKNOWN') return paymentDecision('RECONCILIATION_REQUIRED', false);
  if (input.securePaymentLinkAvailable) return paymentDecision('SECURE_PAYMENT_LINK', true);
  if (input.tokenisedSavedMethodAvailable) return paymentDecision('TOKENISED_SAVED_METHOD', true);
  if (input.pciCompliantIvrAvailable) return paymentDecision('PCI_IVR', true);
  return paymentDecision('UNAVAILABLE', false);
}

function paymentDecision(
  route: ReturnType<typeof telephonePaymentDecision>['route'],
  allowed: boolean
): ReturnType<typeof telephonePaymentDecision> {
  return { route, allowed, rawCardDetailsRetained: false, blindRepeatCollectionAllowed: false };
}

export function callResumeDecision(input: {
  readonly pendingInteractionFound: boolean;
  readonly confirmedFieldsPreserved: boolean;
  readonly idempotencyKeyReused: boolean;
  readonly existingBookingId: string | null;
}): { readonly resumeAllowed: boolean; readonly createNewBookingAllowed: boolean; readonly duplicateBookingRiskAccepted: false } {
  const resumeAllowed = input.pendingInteractionFound && input.confirmedFieldsPreserved && input.idempotencyKeyReused;
  return {
    resumeAllowed,
    createNewBookingAllowed: !input.existingBookingId && !input.pendingInteractionFound,
    duplicateBookingRiskAccepted: false
  };
}

export function recordingAndTranscriptMayBeUsed(input: {
  readonly recordingPurposeDefined: boolean;
  readonly legalBasisDefined: boolean;
  readonly retentionPolicyDefined: boolean;
  readonly accessPolicyDefined: boolean;
  readonly transcriptTreatedAsAuthoritative: boolean;
  readonly unrelatedModelTrainingRequested: boolean;
}): boolean {
  return input.recordingPurposeDefined
    && input.legalBasisDefined
    && input.retentionPolicyDefined
    && input.accessPolicyDefined
    && !input.transcriptTreatedAsAuthoritative
    && !input.unrelatedModelTrainingRequested;
}

export const TELEPHONY_PROVIDER_CONFIGURED = false as const;
export const VOICE_ASSISTANT_PROVIDER_CONFIGURED = false as const;
export const CALLER_ID_ALONE_AUTHENTICATES = false as const;
export const VOICE_RECOGNITION_IS_AUTHORITY = false as const;
export const VOICE_BIOMETRIC_BASELINE_ENABLED = false as const;
export const VOICE_BIOMETRIC_SOLE_HIGH_RISK_AUTHORITY = false as const;
export const FULL_CARD_DETAILS_AVAILABLE_TO_OPERATOR_OR_GENERAL_VOICE = false as const;
export const TELEPHONE_PAYMENT_AUTHORIZES_PRIVATE_ACCOUNT_ACCESS = false as const;
export const AUTOMATED_SAFETY_CLASSIFICATION_PROVES_DANGER_OR_MISCONDUCT = false as const;
export const VOICE_ASSISTANT_MAY_OVERRIDE_BACKEND_RULES = false as const;
