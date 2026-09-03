export interface ClaimFatigueHandoverProjection {
  readonly controlledHandoverId: string;
  readonly taskScopeId: string;
  readonly status: 'OWNED';
  readonly version: number;
  readonly supportCaseStatus: 'IN_PROGRESS';
  readonly operationalHoldStatus: 'ACTIVE';
  readonly passengerContinuityRequired: true;
  readonly outcomeClaimed: false;
  readonly externalServiceContacted: false;
  readonly claimedAt: string;
}

export type FatigueHandoverNextAction =
  | 'RECORD_REPLACEMENT_ASSIGNMENT'
  | 'RECORD_PASSENGER_TRANSFER'
  | 'CONFIRM_SAFE_STOP'
  | 'COMPLETE_HANDOVER';

export interface ControlRoomFatigueHandoverTaskProjection {
  readonly controlledHandoverId: string;
  readonly taskScopeId: string;
  readonly status: 'OWNED' | 'REPLACEMENT_ASSIGNED' | 'PASSENGER_TRANSFERRED' | 'SAFE_STOP_CONFIRMED' | 'COMPLETED';
  readonly version: number;
  readonly journeyId: string;
  readonly supportCaseId: string;
  readonly supportCaseStatus: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  readonly operationalHoldStatus: 'ACTIVE' | 'RELEASED';
  readonly originalAssignmentStatus: string;
  readonly replacementAssignmentRecorded: boolean;
  readonly passengerTransferEvidenceRecorded: boolean;
  readonly safeStopEvidenceRecorded: boolean;
  readonly passengerContinuityRequired: true;
  readonly permittedNextActions: readonly FatigueHandoverNextAction[];
  readonly passengerIdentityIncluded: false;
  readonly passengerContactIncluded: false;
  readonly preciseLocationIncluded: false;
  readonly safetyNarrativeIncluded: false;
  readonly financialDataIncluded: false;
  readonly taskScopeAuthoritative: true;
  readonly evaluatedAt: string;
}

export interface ConfirmFatigueSafeStopRequest {
  readonly evidenceReference: string;
}

export interface ConfirmFatigueSafeStopProjection {
  readonly controlledHandoverId: string;
  readonly taskScopeId: string;
  readonly status: 'SAFE_STOP_CONFIRMED';
  readonly version: number;
  readonly safeStopEvidenceRecorded: true;
  readonly operationalHoldStatus: 'ACTIVE';
  readonly supportCaseStatus: 'IN_PROGRESS';
  readonly passengerContinuityRequired: true;
  readonly handoverComplete: false;
  readonly externalServiceContacted: false;
  readonly confirmedAt: string;
}

export interface CompleteFatigueHandoverRequest {
  readonly completionEvidenceReference: string;
}

export interface CompleteFatigueHandoverProjection {
  readonly controlledHandoverId: string;
  readonly taskScopeId: string;
  readonly status: 'COMPLETED';
  readonly version: number;
  readonly operationalHoldStatus: 'RELEASED';
  readonly supportCaseStatus: 'RESOLVED';
  readonly passengerContinuityVerified: true;
  readonly fatigueObservationCleared: false;
  readonly driverReturnedToWork: false;
  readonly externalServiceContacted: false;
  readonly completedAt: string;
}

export interface RecordFatigueReplacementAssignmentRequest {
  readonly replacementAssignmentId: string;
  readonly evidenceReference: string;
}

export interface RecordFatigueReplacementAssignmentProjection {
  readonly controlledHandoverId: string;
  readonly taskScopeId: string;
  readonly replacementAssignmentId: string;
  readonly status: 'REPLACEMENT_ASSIGNED';
  readonly version: number;
  readonly operationalHoldStatus: 'ACTIVE';
  readonly supportCaseStatus: 'IN_PROGRESS';
  readonly passengerContinuityRequired: true;
  readonly passengerTransferEvidenceRecorded: false;
  readonly handoverComplete: false;
  readonly externalServiceContacted: false;
  readonly recordedAt: string;
}

export interface RecordFatiguePassengerTransferRequest {
  readonly evidenceReference: string;
}

export interface RecordFatiguePassengerTransferProjection {
  readonly controlledHandoverId: string;
  readonly taskScopeId: string;
  readonly status: 'PASSENGER_TRANSFERRED';
  readonly version: number;
  readonly passengerTransferEvidenceRecorded: true;
  readonly operationalHoldStatus: 'ACTIVE';
  readonly supportCaseStatus: 'IN_PROGRESS';
  readonly passengerContinuityRequired: true;
  readonly handoverComplete: false;
  readonly externalServiceContacted: false;
  readonly recordedAt: string;
}
