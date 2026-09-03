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
