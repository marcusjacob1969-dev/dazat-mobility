export const MAINTENANCE_PLAN_SOURCES = [
  'MANUFACTURER', 'LEGAL_LICENSING', 'DAZAT_POLICY', 'FLEET_AGREEMENT',
  'DEFECT', 'RECALL', 'BREAKDOWN_FOLLOW_UP'
] as const;
export type MaintenancePlanSource = (typeof MAINTENANCE_PLAN_SOURCES)[number];

export const MAINTENANCE_URGENCIES = [
  'ROUTINE', 'DUE_SOON', 'OVERDUE', 'SAFETY_REVIEW', 'DO_NOT_USE'
] as const;
export type MaintenanceUrgency = (typeof MAINTENANCE_URGENCIES)[number];

export const PRE_SHIFT_ITEM_RESULTS = ['PASS', 'FAIL', 'NOT_SURE', 'NOT_APPLICABLE'] as const;
export type PreShiftItemResult = (typeof PRE_SHIFT_ITEM_RESULTS)[number];

export const PRE_SHIFT_CHECK_ITEMS = [
  'TYRES', 'LIGHTS', 'BRAKES', 'STEERING', 'MIRRORS', 'SEATBELTS',
  'WARNING_INDICATORS', 'ACCESSIBILITY_EQUIPMENT'
] as const;
export type PreShiftCheckItem = (typeof PRE_SHIFT_CHECK_ITEMS)[number];

export interface PreShiftCheckInput {
  readonly items: Readonly<Record<PreShiftCheckItem, PreShiftItemResult>>;
  readonly uncertainConcernText: string | null;
}

export interface PreShiftCheckDecision {
  readonly outcome: 'PASS' | 'CONCERN_REPORTED' | 'FAIL';
  readonly maintenanceUrgency: 'ROUTINE' | 'SAFETY_REVIEW' | 'DO_NOT_USE';
  readonly vehicleUsePermitted: boolean;
  readonly createDefect: boolean;
  readonly driverDiagnosisRequired: false;
  readonly createsDriverFaultFinding: false;
}

export function evaluatePreShiftCheck(input: PreShiftCheckInput): PreShiftCheckDecision {
  const values = PRE_SHIFT_CHECK_ITEMS.map((item) => input.items[item]);
  if (values.some((value) => !PRE_SHIFT_ITEM_RESULTS.includes(value))) {
    throw new Error('Every pre-shift item requires an explicit result');
  }
  const mandatoryItems = PRE_SHIFT_CHECK_ITEMS.filter((item) => item !== 'ACCESSIBILITY_EQUIPMENT');
  if (mandatoryItems.some((item) => input.items[item] === 'NOT_APPLICABLE')) {
    throw new Error('Core roadworthiness items cannot be marked not applicable');
  }
  const failed = values.includes('FAIL');
  const uncertain = values.includes('NOT_SURE') || Boolean(input.uncertainConcernText?.trim());
  if (failed) return {
    outcome: 'FAIL', maintenanceUrgency: 'DO_NOT_USE', vehicleUsePermitted: false,
    createDefect: true, driverDiagnosisRequired: false, createsDriverFaultFinding: false
  };
  if (uncertain) return {
    outcome: 'CONCERN_REPORTED', maintenanceUrgency: 'SAFETY_REVIEW', vehicleUsePermitted: false,
    createDefect: true, driverDiagnosisRequired: false, createsDriverFaultFinding: false
  };
  return {
    outcome: 'PASS', maintenanceUrgency: 'ROUTINE', vehicleUsePermitted: true,
    createDefect: false, driverDiagnosisRequired: false, createsDriverFaultFinding: false
  };
}

export interface MaintenanceOperatingGateInput {
  readonly activePlanPresent: boolean;
  readonly activeRequirementsPresent: boolean;
  readonly highestUrgency: MaintenanceUrgency | null;
  readonly allServicesRestrictionActive: boolean;
  readonly unresolvedSafetyCriticalRecall: boolean;
  readonly restrictedServiceCodes: readonly string[];
  readonly requestedServiceCodes: readonly string[];
}

export interface MaintenanceOperatingGateDecision {
  readonly operatingPermitted: boolean;
  readonly blockers: readonly string[];
  readonly actionRequired: boolean;
  readonly overdueAutomaticallyProvesNeglect: false;
}

export function evaluateMaintenanceOperatingGate(
  input: MaintenanceOperatingGateInput
): MaintenanceOperatingGateDecision {
  const blockers: string[] = [];
  if (!input.activePlanPresent) blockers.push('ACTIVE_MAINTENANCE_PLAN_REQUIRED');
  if (!input.activeRequirementsPresent) blockers.push('CURRENT_MAINTENANCE_REQUIREMENTS_REQUIRED');
  if (input.highestUrgency === 'SAFETY_REVIEW') blockers.push('VEHICLE_SAFETY_REVIEW_REQUIRED');
  if (input.highestUrgency === 'DO_NOT_USE') blockers.push('VEHICLE_DO_NOT_USE');
  if (input.allServicesRestrictionActive) blockers.push('VEHICLE_ALL_SERVICES_RESTRICTED');
  if (input.unresolvedSafetyCriticalRecall) blockers.push('UNRESOLVED_SAFETY_CRITICAL_RECALL');
  const restricted = new Set(input.restrictedServiceCodes);
  if (input.requestedServiceCodes.some((serviceCode) => restricted.has(serviceCode))) {
    blockers.push('VEHICLE_SERVICE_RESTRICTED');
  }
  return {
    operatingPermitted: blockers.length === 0,
    blockers,
    actionRequired: blockers.length > 0 || ['DUE_SOON', 'OVERDUE'].includes(input.highestUrgency ?? ''),
    overdueAutomaticallyProvesNeglect: false
  };
}

export const VEHICLE_DEFECT_STATES = ['OPEN', 'UNDER_REVIEW', 'REPAIR_REQUIRED', 'MONITORING', 'RESOLVED', 'CLOSED'] as const;
export type VehicleDefectState = (typeof VEHICLE_DEFECT_STATES)[number];

const defectTransitions: Readonly<Record<VehicleDefectState, readonly VehicleDefectState[]>> = {
  OPEN: ['UNDER_REVIEW', 'REPAIR_REQUIRED', 'MONITORING', 'RESOLVED'],
  UNDER_REVIEW: ['REPAIR_REQUIRED', 'MONITORING', 'RESOLVED'],
  REPAIR_REQUIRED: ['UNDER_REVIEW', 'MONITORING', 'RESOLVED'],
  MONITORING: ['UNDER_REVIEW', 'REPAIR_REQUIRED', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'UNDER_REVIEW'],
  CLOSED: []
};

export function canTransitionVehicleDefect(from: VehicleDefectState, to: VehicleDefectState): boolean {
  return defectTransitions[from].includes(to);
}

export function repairMayBeAuthorised(input: {
  readonly estimatePresent: boolean;
  readonly warrantyEvaluatedFirst: boolean;
  readonly authorisedDecision: boolean;
}): boolean {
  return input.estimatePresent && input.warrantyEvaluatedFirst && input.authorisedDecision;
}

export function returnToServiceMayBeApproved(input: {
  readonly completionRecordPresent: boolean;
  readonly postRepairInspectionPassed: boolean;
  readonly openSafetyCriticalDefect: boolean;
  readonly activeVehicleRestriction: boolean;
  readonly requiredMaintenanceOutstanding: boolean;
  readonly independentReviewer: boolean;
  readonly evidenceReferences: readonly string[];
}): boolean {
  return input.completionRecordPresent && input.postRepairInspectionPassed
    && !input.openSafetyCriticalDefect && !input.activeVehicleRestriction
    && !input.requiredMaintenanceOutstanding && input.independentReviewer
    && input.evidenceReferences.length > 0
    && input.evidenceReferences.every((reference) => reference.trim().length > 0);
}

export function verifiedPerkMayBePublished(input: {
  readonly providerVerified: boolean;
  readonly benefitTermsExplicit: boolean;
  readonly eligibilityExplicit: boolean;
  readonly redemptionRouteExplicit: boolean;
  readonly evidenceReferences: readonly string[];
  readonly currentlyEffective: boolean;
}): boolean {
  return input.providerVerified && input.benefitTermsExplicit && input.eligibilityExplicit
    && input.redemptionRouteExplicit && input.currentlyEffective
    && input.evidenceReferences.length > 0;
}

export const WHOLE_LIFE_COST_COMPONENTS = [
  'ACQUISITION', 'DEPRECIATION', 'INSURANCE', 'SERVICE', 'REPAIR',
  'TYRES', 'ENERGY', 'DOWNTIME', 'RESALE'
] as const;
export type WholeLifeCostComponent = (typeof WHOLE_LIFE_COST_COMPONENTS)[number];

export function wholeLifeCostEvidenceIsComplete(input: {
  readonly componentsMinor: Readonly<Record<WholeLifeCostComponent, number>>;
  readonly evidenceReferences: readonly string[];
  readonly brochurePriceOnly: boolean;
}): boolean {
  return !input.brochurePriceOnly
    && WHOLE_LIFE_COST_COMPONENTS.every((component) => {
      const amount = input.componentsMinor[component];
      return Number.isSafeInteger(amount) && amount >= 0;
    })
    && input.evidenceReferences.length > 0;
}

export const BREAKDOWN_ALONE_PROVES_DRIVER_NEGLECT = false as const;
export const VEHICLE_RELIABILITY_IS_DRIVER_COMPLIANCE = false as const;
export const DEFECT_REPORT_CREATES_DRIVER_FAULT_FINDING = false as const;
export const REPLACEMENT_WORKFLOW_MAY_PENALISE_DEFECT_REPORTING = false as const;
export const PASSENGER_CONTINUITY_IS_REPLACEMENT_ASSIGNMENT = false as const;
export const UNVERIFIED_PERK_MAY_BE_MARKETED = false as const;
