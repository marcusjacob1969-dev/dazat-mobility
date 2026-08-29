export const DRIVER_APPLICATION_STATUSES = [
  'STARTED', 'CONTACT_VERIFIED', 'IDENTITY_PENDING', 'DOCUMENTS_PENDING', 'TRAINING_PENDING',
  'VEHICLE_PENDING', 'REVIEW_PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'
] as const;

export type DriverApplicationStatus = (typeof DRIVER_APPLICATION_STATUSES)[number];

const applicationTransitions: Readonly<Record<DriverApplicationStatus, readonly DriverApplicationStatus[]>> = {
  STARTED: ['CONTACT_VERIFIED', 'WITHDRAWN', 'EXPIRED'],
  CONTACT_VERIFIED: ['IDENTITY_PENDING', 'WITHDRAWN', 'EXPIRED'],
  IDENTITY_PENDING: ['DOCUMENTS_PENDING', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  DOCUMENTS_PENDING: ['TRAINING_PENDING', 'VEHICLE_PENDING', 'REVIEW_PENDING', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  TRAINING_PENDING: ['DOCUMENTS_PENDING', 'VEHICLE_PENDING', 'REVIEW_PENDING', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  VEHICLE_PENDING: ['DOCUMENTS_PENDING', 'TRAINING_PENDING', 'REVIEW_PENDING', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  REVIEW_PENDING: ['DOCUMENTS_PENDING', 'TRAINING_PENDING', 'VEHICLE_PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  APPROVED: [], DECLINED: [], WITHDRAWN: [], EXPIRED: []
};

export function canTransitionDriverApplication(from: DriverApplicationStatus, to: DriverApplicationStatus): boolean {
  return applicationTransitions[from].includes(to);
}

export const DRIVER_DOCUMENT_STATUSES = [
  'UPLOADED', 'EXTRACTION_PENDING', 'EXTRACTED', 'REVIEW_PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'
] as const;
export type DriverDocumentStatus = (typeof DRIVER_DOCUMENT_STATUSES)[number];

export function documentSatisfiesCompliance(input: {
  readonly status: DriverDocumentStatus;
  readonly authorisedReviewDecision: 'VERIFIED' | 'REJECTED' | null;
  readonly validUntil: Date | null;
  readonly now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return input.status === 'VERIFIED'
    && input.authorisedReviewDecision === 'VERIFIED'
    && (!input.validUntil || input.validUntil.getTime() > now.getTime());
}

export type TrainingRecordStatus = 'ATTENDED' | 'PASSED' | 'FAILED' | 'EXPIRED' | 'REVOKED';

export function trainingGrantsCompetency(input: {
  readonly status: TrainingRecordStatus;
  readonly assessmentRequired: boolean;
  readonly assessmentPassed: boolean;
  readonly competencyConfirmed: boolean;
  readonly validUntil: Date | null;
  readonly now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return input.status === 'PASSED'
    && input.competencyConfirmed
    && (!input.assessmentRequired || input.assessmentPassed)
    && (!input.validUntil || input.validUntil.getTime() > now.getTime());
}

export const DRIVER_RESTRICTION_SCOPES = [
  'ALL_SERVICES', 'SCHOOL_ONLY', 'WAV_ONLY', 'NEW_JOURNEYS', 'PAYOUT_ONLY', 'SPECIFIC_VEHICLE'
] as const;
export type DriverRestrictionScope = (typeof DRIVER_RESTRICTION_SCOPES)[number];

export type DriverOperatingEligibilityStatus = 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE';

export interface DriverOperatingEligibilityInput {
  readonly accountActive: boolean;
  readonly driverApproved: boolean;
  readonly complianceCurrent: boolean;
  readonly selectedVehiclePresent: boolean;
  readonly selectedVehicleAuthorised: boolean;
  readonly selectedVehicleEligible: boolean;
  readonly currentPermissionServiceCodes: readonly string[];
  readonly activeRestrictionScopes: readonly DriverRestrictionScope[];
}

export interface DriverOperatingEligibilityDecision {
  readonly status: DriverOperatingEligibilityStatus;
  readonly eligibleServiceCodes: readonly string[];
  readonly blockers: readonly string[];
  readonly availabilityEvaluatedSeparately: true;
}

export function evaluateDriverOperatingEligibility(
  input: DriverOperatingEligibilityInput
): DriverOperatingEligibilityDecision {
  const blockers: string[] = [];
  if (!input.accountActive) blockers.push('ACCOUNT_NOT_ACTIVE');
  if (!input.driverApproved) blockers.push('DRIVER_APPLICATION_NOT_APPROVED');
  if (!input.complianceCurrent) blockers.push('DRIVER_COMPLIANCE_NOT_CURRENT');
  if (!input.selectedVehiclePresent) blockers.push('SELECTED_VEHICLE_REQUIRED');
  else {
    if (!input.selectedVehicleAuthorised) blockers.push('DRIVER_VEHICLE_PAIR_NOT_AUTHORISED');
    if (!input.selectedVehicleEligible) blockers.push('VEHICLE_NOT_ELIGIBLE');
  }
  if (input.activeRestrictionScopes.includes('ALL_SERVICES') || input.activeRestrictionScopes.includes('NEW_JOURNEYS')) {
    blockers.push('OPERATING_RESTRICTION_ACTIVE');
  }
  if (input.activeRestrictionScopes.includes('SPECIFIC_VEHICLE')) {
    blockers.push('SELECTED_VEHICLE_RESTRICTION_ACTIVE');
  }
  const currentServices = [...new Set(input.currentPermissionServiceCodes
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean))].sort();
  const services = currentServices.filter((serviceCode) => {
    if (input.activeRestrictionScopes.includes('SCHOOL_ONLY') && serviceCode.includes('SCHOOL')) return false;
    if (input.activeRestrictionScopes.includes('WAV_ONLY') && serviceCode.includes('WAV')) return false;
    return true;
  });
  if (!currentServices.length) blockers.push('NO_CURRENT_SERVICE_PERMISSION');
  else if (!services.length) blockers.push('ALL_CURRENT_SERVICE_PERMISSIONS_RESTRICTED');
  const hardBlocked = blockers.length > 0;
  const scopedRestriction = services.length < currentServices.length;
  return {
    status: hardBlocked ? 'NOT_ELIGIBLE' : scopedRestriction ? 'PARTIALLY_ELIGIBLE' : 'ELIGIBLE',
    eligibleServiceCodes: hardBlocked ? [] : services,
    blockers,
    availabilityEvaluatedSeparately: true
  };
}

export const OCR_IS_AUTHORITATIVE_COMPLIANCE_VERIFICATION = false as const;
