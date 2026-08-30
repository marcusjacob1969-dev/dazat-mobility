export type RiderConductCategory =
  | 'VIOLENCE'
  | 'HARASSMENT'
  | 'DISCRIMINATION'
  | 'FRAUD'
  | 'DANGEROUS_BEHAVIOUR'
  | 'CONTACT_ABUSE'
  | 'OTHER';

export type DriverAppealSubjectType =
  | 'COMPLAINT_FINDING'
  | 'DRIVER_RESTRICTION'
  | 'OFFBOARDING_DECISION'
  | 'INCENTIVE_QUALIFICATION';

export interface DriverComplaintSummary {
  readonly complaintId: string;
  readonly category: 'SERVICE' | 'CONDUCT' | 'SAFETY' | 'DISCRIMINATION' | 'FRAUD' | 'CANCELLATION' | 'NO_SHOW' | 'OTHER';
  readonly status: 'ALLEGATION_RECORDED' | 'DRIVER_RESPONSE_PENDING' | 'ASSESSMENT_PENDING' | 'FINDING_RECORDED' | 'ACTION_PENDING' | 'CLOSED' | 'WITHDRAWN';
  readonly responseOpportunityProvided: boolean;
  readonly responseDueAt?: string;
  readonly finding?: 'SUBSTANTIATED' | 'NOT_SUBSTANTIATED' | 'INCONCLUSIVE' | 'NO_FINDING';
  readonly allegationIsFinding: false;
}

export interface DriverRestrictionSummary {
  readonly restrictionId: string;
  readonly scope: string;
  readonly precautionary: boolean;
  readonly restrictionBasis: 'PRECAUTIONARY' | 'ASSESSED_FINDING' | 'LEGAL_REQUIREMENT' | 'DRIVER_REQUEST';
  readonly reviewDueAt?: string;
  readonly narrowestSafeScope: true;
  readonly guiltFinding: false;
}

export interface DriverAppealSummary {
  readonly appealId: string;
  readonly subjectType: DriverAppealSubjectType;
  readonly subjectId: string;
  readonly status: 'SUBMITTED' | 'UNDER_REVIEW' | 'UPHELD' | 'VARIED' | 'OVERTURNED' | 'CLOSED';
  readonly submittedAt: string;
  readonly independentReviewRequired: true;
  readonly originalDecisionHistoryPreserved: true;
}

export interface DriverFairTreatmentProjection {
  readonly driverProfileId: string;
  readonly dimensions: Readonly<{
    ratingFeedbackCount: number;
    averageRating?: number;
    openComplaintCount: number;
    substantiatedFindingCount: number;
    activeRestrictionCount: number;
    openAppealCount: number;
    openRiderConductCaseCount: number;
  }>;
  readonly complaints: readonly DriverComplaintSummary[];
  readonly restrictions: readonly DriverRestrictionSummary[];
  readonly appeals: readonly DriverAppealSummary[];
  readonly opaqueDriverScoreUsed: false;
  readonly ratingIsFinding: false;
  readonly ordinaryDeclinePenaltyApplied: false;
  readonly source: 'AUTHORITATIVE_CURRENT_PROJECTION';
  readonly evaluatedAt: string;
}

export interface SubmitRiderConductReportRequest {
  readonly journeyId: string;
  readonly categories: readonly RiderConductCategory[];
  readonly reportReference: string;
  readonly immediateDanger: boolean;
}

export interface RiderConductCaseProjection {
  readonly riderConductCaseId: string;
  readonly safetyEventId: string;
  readonly journeyId: string;
  readonly status: 'OPEN';
  readonly safeTerminationProtected: true;
  readonly ratingProtectionRequired: true;
  readonly driverMisconductFindingCreated: false;
  readonly unsafeJourneyTerminated: boolean;
  readonly recordedAt: string;
}

export interface UnsafeJourneyTerminationProjection extends RiderConductCaseProjection {
  readonly unsafeJourneyTerminated: true;
  readonly bookingStatus: 'ACTIVE_INCIDENT';
  readonly assignmentStatus: 'CANCELLED';
  readonly driverAvailability: 'BREAK';
  readonly passengerContinuityOpened: true;
  readonly ratingProtected: true;
  readonly driverFaultFindingCreated: false;
}

export interface SubmitDriverAppealRequest {
  readonly subjectType: DriverAppealSubjectType;
  readonly subjectId: string;
  readonly reasonCategory: 'FACTUAL_ERROR' | 'MISSING_EVIDENCE' | 'PROCEDURAL_FAIRNESS' | 'DISPROPORTIONATE_ACTION' | 'OTHER';
  readonly statementReference: string;
  readonly evidenceReferences?: readonly string[];
}

export interface SubmitDriverAppealProjection extends DriverAppealSummary {
  readonly status: 'SUBMITTED';
}

export interface DriverIncentiveProjection {
  readonly programmeVersionId: string;
  readonly programmeKey: string;
  readonly version: number;
  readonly title: string;
  readonly regionCode: string;
  readonly visibleTerms: readonly string[];
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly qualification?: Readonly<{
    outcome: 'QUALIFIED' | 'NOT_QUALIFIED' | 'PENDING_EVIDENCE';
    explanation: string;
    amountMinor?: number;
    currency?: string;
    evaluatedAt: string;
  }>;
  readonly disputeRoute: 'DRIVER_APPEAL';
  readonly baseEarningSeparate: true;
  readonly acceptanceCoercionAllowed: false;
  readonly fatiguePressureAllowed: false;
  readonly secretDispatchPriorityBoostAllowed: false;
  readonly financeApproved: true;
}
