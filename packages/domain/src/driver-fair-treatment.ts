export const DRIVER_PERFORMANCE_DIMENSIONS = [
  'RATING_FEEDBACK',
  'SAFETY',
  'COMPLIANCE',
  'RELIABILITY',
  'CUSTOMER_FEEDBACK',
  'CANCELLATIONS',
  'TRAINING',
  'SECURITY'
] as const;

export type DriverPerformanceDimension = (typeof DRIVER_PERFORMANCE_DIMENSIONS)[number];

export const DRIVER_OFFER_OUTCOMES = [
  'ACCEPTED',
  'DECLINED',
  'TIMED_OUT',
  'TECHNICAL_FAILURE',
  'WITHDRAWN',
  'DRIVER_BECAME_INELIGIBLE',
  'ASSIGNED_ELSEWHERE'
] as const;

export type DriverOfferOutcome = (typeof DRIVER_OFFER_OUTCOMES)[number];

export interface RatingFeedbackTreatment {
  readonly acceptedAsFeedback: true;
  readonly conductFindingCreated: false;
  readonly driverRestrictionCreated: false;
  readonly dispatchPriorityChanged: false;
}

export function evaluateRatingFeedback(rating: number): RatingFeedbackTreatment {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Driver rating feedback must be a whole number from one to five');
  }
  return {
    acceptedAsFeedback: true,
    conductFindingCreated: false,
    driverRestrictionCreated: false,
    dispatchPriorityChanged: false
  };
}

export const DRIVER_COMPLAINT_STATUSES = [
  'ALLEGATION_RECORDED',
  'DRIVER_RESPONSE_PENDING',
  'ASSESSMENT_PENDING',
  'FINDING_RECORDED',
  'ACTION_PENDING',
  'CLOSED',
  'WITHDRAWN'
] as const;

export type DriverComplaintStatus = (typeof DRIVER_COMPLAINT_STATUSES)[number];

const complaintTransitions: Readonly<Record<DriverComplaintStatus, readonly DriverComplaintStatus[]>> = {
  ALLEGATION_RECORDED: ['DRIVER_RESPONSE_PENDING', 'WITHDRAWN'],
  DRIVER_RESPONSE_PENDING: ['ASSESSMENT_PENDING', 'WITHDRAWN'],
  ASSESSMENT_PENDING: ['FINDING_RECORDED', 'WITHDRAWN'],
  FINDING_RECORDED: ['ACTION_PENDING', 'CLOSED'],
  ACTION_PENDING: ['CLOSED'],
  CLOSED: [],
  WITHDRAWN: []
};

export function canTransitionDriverComplaint(from: DriverComplaintStatus, to: DriverComplaintStatus): boolean {
  return complaintTransitions[from].includes(to);
}

export function complaintFindingMayBeRecorded(input: {
  readonly responseOpportunityProvided: boolean;
  readonly assessmentPresent: boolean;
  readonly evidenceReferences: readonly string[];
  readonly authorisedIndependentReviewer: boolean;
  readonly ratingOnly: boolean;
}): boolean {
  return input.responseOpportunityProvided
    && input.assessmentPresent
    && input.evidenceReferences.length > 0
    && input.authorisedIndependentReviewer
    && !input.ratingOnly;
}

export interface OfferOutcomeFairnessDecision {
  readonly outcome: DriverOfferOutcome;
  readonly recordsExactOutcome: true;
  readonly automaticallyCreatesMisconduct: false;
  readonly acceptanceRatePenaltyApplied: false;
  readonly dispatchPriorityPenaltyApplied: false;
  readonly requiresSeparateReliabilityReview: boolean;
}

export function evaluateOfferOutcomeFairness(outcome: DriverOfferOutcome): OfferOutcomeFairnessDecision {
  if (!DRIVER_OFFER_OUTCOMES.includes(outcome)) throw new Error(`Unsupported Driver offer outcome: ${outcome}`);
  return {
    outcome,
    recordsExactOutcome: true,
    automaticallyCreatesMisconduct: false,
    acceptanceRatePenaltyApplied: false,
    dispatchPriorityPenaltyApplied: false,
    requiresSeparateReliabilityReview: false
  };
}

export type ReliabilityCause = 'DRIVER' | 'VEHICLE' | 'SYSTEM' | 'PROVIDER' | 'TRAFFIC' | 'EXTERNAL' | 'UNDETERMINED';

export interface ReliabilityAttributionDecision {
  readonly reliabilityConcernSupported: boolean;
  readonly createsMisconductFinding: false;
  readonly needsMoreEvidence: boolean;
}

export function evaluateReliabilityAttribution(input: {
  readonly acceptedCommitment: boolean;
  readonly cause: ReliabilityCause;
  readonly evidenceReferences: readonly string[];
}): ReliabilityAttributionDecision {
  const evidencePresent = input.evidenceReferences.length > 0;
  return {
    reliabilityConcernSupported: input.acceptedCommitment && input.cause === 'DRIVER' && evidencePresent,
    createsMisconductFinding: false,
    needsMoreEvidence: !evidencePresent || input.cause === 'UNDETERMINED'
  };
}

export function precautionaryRestrictionMayBeApplied(input: {
  readonly evidenceReferences: readonly string[];
  readonly narrowestSafeScope: boolean;
  readonly reviewDueAt: Date | null;
  readonly guiltFindingCreated: boolean;
}): boolean {
  return input.evidenceReferences.length > 0
    && input.narrowestSafeScope
    && input.reviewDueAt !== null
    && !input.guiltFindingCreated;
}

export const DRIVER_APPEAL_SUBJECT_TYPES = [
  'COMPLAINT_FINDING',
  'DRIVER_RESTRICTION',
  'OFFBOARDING_DECISION',
  'INCENTIVE_QUALIFICATION'
] as const;

export type DriverAppealSubjectType = (typeof DRIVER_APPEAL_SUBJECT_TYPES)[number];

export function highImpactAppealMayBeResolved(input: {
  readonly evidenceReferences: readonly string[];
  readonly independentFromOriginalDecision: boolean;
  readonly reviewerIsDriver: boolean;
  readonly originalDecisionHistoryPreserved: boolean;
}): boolean {
  return input.evidenceReferences.length > 0
    && input.independentFromOriginalDecision
    && !input.reviewerIsDriver
    && input.originalDecisionHistoryPreserved;
}

export const RIDER_CONDUCT_CATEGORIES = [
  'VIOLENCE',
  'HARASSMENT',
  'DISCRIMINATION',
  'FRAUD',
  'DANGEROUS_BEHAVIOUR',
  'CONTACT_ABUSE',
  'OTHER'
] as const;

export type RiderConductCategory = (typeof RIDER_CONDUCT_CATEGORIES)[number];

export function unsafeJourneyTerminationMayProceed(input: {
  readonly actorIsAssignedDriver: boolean;
  readonly journeyStatus: string;
  readonly riderConductCasePersisted: boolean;
  readonly canonicalSafetyEventPersisted: boolean;
}): boolean {
  return input.actorIsAssignedDriver
    && ['EN_ROUTE', 'ARRIVED', 'AWAITING_RIDECHECK', 'PASSENGER_VERIFIED', 'IN_PROGRESS', 'ARRIVING'].includes(input.journeyStatus)
    && input.riderConductCasePersisted
    && input.canonicalSafetyEventPersisted;
}

export function driverMayEnterBreakAfterUnsafeTermination(input: {
  readonly fromAvailability: string;
  readonly assignmentCancelled: boolean;
  readonly safetyTerminationPersisted: boolean;
  readonly passengerContinuityOpened: boolean;
}): boolean {
  return input.fromAvailability === 'ASSIGNED'
    && input.assignmentCancelled
    && input.safetyTerminationPersisted
    && input.passengerContinuityOpened;
}

export function driverIncentiveMayBePublished(input: {
  readonly versionedRules: boolean;
  readonly visibleTerms: readonly string[];
  readonly financeApproved: boolean;
  readonly evidenceReferences: readonly string[];
  readonly baseEarningSeparate: boolean;
  readonly acceptanceCoercionAllowed: boolean;
  readonly fatiguePressureAllowed: boolean;
  readonly secretDispatchPriorityBoostAllowed: boolean;
}): boolean {
  return input.versionedRules
    && input.visibleTerms.length > 0
    && input.financeApproved
    && input.evidenceReferences.length > 0
    && input.baseEarningSeparate
    && !input.acceptanceCoercionAllowed
    && !input.fatiguePressureAllowed
    && !input.secretDispatchPriorityBoostAllowed;
}

export function offboardingHistoryIsPreserved(input: {
  readonly earningsPreserved: boolean;
  readonly disputesPreserved: boolean;
  readonly vehicleReturnObligationsPreserved: boolean;
  readonly safetyHistoryPreserved: boolean;
  readonly financialHistoryPreserved: boolean;
}): boolean {
  return input.earningsPreserved
    && input.disputesPreserved
    && input.vehicleReturnObligationsPreserved
    && input.safetyHistoryPreserved
    && input.financialHistoryPreserved;
}

export const OPAQUE_DRIVER_SCORE_USED = false as const;
export const RIDER_RATING_IS_CONDUCT_FINDING = false as const;
export const ORDINARY_OFFER_DECLINE_IS_MISCONDUCT = false as const;
export const ORDINARY_OFFER_DECLINE_CHANGES_DISPATCH_PRIORITY = false as const;
export const TEMPORARY_RESTRICTION_IS_GUILT = false as const;
export const SAFE_JOURNEY_TERMINATION_MAY_HARM_RATING = false as const;
export const INCENTIVE_MAY_PRESSURE_UNSAFE_FATIGUE = false as const;
export const OFFBOARDING_MAY_ERASE_HISTORICAL_TRUTH = false as const;
