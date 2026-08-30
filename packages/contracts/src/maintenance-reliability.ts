export type MaintenanceUrgency = 'ROUTINE' | 'DUE_SOON' | 'OVERDUE' | 'SAFETY_REVIEW' | 'DO_NOT_USE';
export type PreShiftItemResult = 'PASS' | 'FAIL' | 'NOT_SURE' | 'NOT_APPLICABLE';
export type MandatoryPreShiftItemResult = Exclude<PreShiftItemResult, 'NOT_APPLICABLE'>;

export interface SubmitPreShiftCheckRequest {
  readonly occurredAt: string;
  readonly odometer: number;
  readonly items: Readonly<{
    TYRES: MandatoryPreShiftItemResult;
    LIGHTS: MandatoryPreShiftItemResult;
    BRAKES: MandatoryPreShiftItemResult;
    STEERING: MandatoryPreShiftItemResult;
    MIRRORS: MandatoryPreShiftItemResult;
    SEATBELTS: MandatoryPreShiftItemResult;
    WARNING_INDICATORS: MandatoryPreShiftItemResult;
    ACCESSIBILITY_EQUIPMENT: PreShiftItemResult;
  }>;
  readonly uncertainConcernText?: string;
  readonly evidenceReferences?: readonly string[];
}

export interface PreShiftCheckProjection {
  readonly checkId: string;
  readonly vehicleId: string;
  readonly outcome: 'PASS' | 'CONCERN_REPORTED' | 'FAIL';
  readonly maintenanceUrgency: 'ROUTINE' | 'SAFETY_REVIEW' | 'DO_NOT_USE';
  readonly vehicleUsePermitted: boolean;
  readonly defectId?: string;
  readonly vehicleRestrictionId?: string;
  readonly driverDiagnosisRequired: false;
  readonly createsDriverFaultFinding: false;
  readonly recordedAt: string;
}

export interface VehicleMaintenanceRequirementProjection {
  readonly requirementId: string;
  readonly requirementCode: string;
  readonly sourceType: 'MANUFACTURER' | 'LEGAL_LICENSING' | 'DAZAT_POLICY' | 'FLEET_AGREEMENT' | 'DEFECT' | 'RECALL' | 'BREAKDOWN_FOLLOW_UP';
  readonly urgency: MaintenanceUrgency;
  readonly status: 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  readonly dueAt?: string;
  readonly dueOdometer?: number;
}

export interface VehicleMaintenanceProjection {
  readonly vehicleId: string;
  readonly activePlanPresent: boolean;
  readonly planVersionId?: string;
  readonly highestUrgency?: MaintenanceUrgency;
  readonly operatingPermitted: boolean;
  readonly blockers: readonly string[];
  readonly restrictedServiceCodes: readonly string[];
  readonly unresolvedSafetyCriticalRecall: boolean;
  readonly openDefectCount: number;
  readonly requirements: readonly VehicleMaintenanceRequirementProjection[];
  readonly breakdownAloneProvesDriverNeglect: false;
  readonly reliabilityIsDriverCompliance: false;
  readonly source: 'AUTHORITATIVE_CURRENT_PROJECTION';
  readonly evaluatedAt: string;
}

export interface VerifiedDriverPerkProjection {
  readonly perkOfferId: string;
  readonly programmeName: string;
  readonly category: 'FUEL' | 'CHARGING' | 'TYRES' | 'SERVICING' | 'INSURANCE' | 'INSPECTION' | 'TRAINING';
  readonly benefitTerms: readonly string[];
  readonly eligibilityTerms: readonly string[];
  readonly redemptionRoute: string;
  readonly providerVerifiedAt: string;
  readonly effectiveUntil?: string;
  readonly verifiedBeforeMarketing: true;
}
