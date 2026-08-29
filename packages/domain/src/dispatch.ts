export const DRIVER_AVAILABILITY_STATUSES = [
  'OFFLINE',
  'AVAILABLE',
  'OFFERED',
  'ASSIGNED',
  'BREAK',
  'FINISHING_SOON'
] as const;

export type DriverAvailabilityStatus = (typeof DRIVER_AVAILABILITY_STATUSES)[number];

export const DRIVER_ELIGIBILITY_STATUSES = ['ELIGIBLE', 'INELIGIBLE', 'REVIEW_REQUIRED'] as const;
export type DriverEligibilityStatus = (typeof DRIVER_ELIGIBILITY_STATUSES)[number];

export const DISPATCH_ATTEMPT_STATUSES = [
  'SEARCHING',
  'OFFERING',
  'ASSIGNED',
  'NO_ELIGIBLE_DRIVER',
  'CANCELLED'
] as const;
export type DispatchAttemptStatus = (typeof DISPATCH_ATTEMPT_STATUSES)[number];

export const DRIVER_OFFER_STATUSES = [
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'WITHDRAWN',
  'LOST_RACE'
] as const;
export type DriverOfferStatus = (typeof DRIVER_OFFER_STATUSES)[number];

const availabilityTransitions: Readonly<Record<DriverAvailabilityStatus, readonly DriverAvailabilityStatus[]>> = {
  OFFLINE: ['AVAILABLE'],
  AVAILABLE: ['OFFLINE', 'OFFERED', 'ASSIGNED', 'BREAK', 'FINISHING_SOON'],
  OFFERED: ['AVAILABLE', 'OFFLINE', 'ASSIGNED', 'BREAK', 'FINISHING_SOON'],
  ASSIGNED: [],
  BREAK: ['AVAILABLE', 'OFFLINE', 'FINISHING_SOON'],
  FINISHING_SOON: ['AVAILABLE', 'OFFLINE', 'OFFERED', 'ASSIGNED', 'BREAK']
};

const offerTransitions: Readonly<Record<DriverOfferStatus, readonly DriverOfferStatus[]>> = {
  OFFERED: ['ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'LOST_RACE'],
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
  WITHDRAWN: [],
  LOST_RACE: []
};

export function canTransitionDriverAvailability(
  from: DriverAvailabilityStatus,
  to: DriverAvailabilityStatus
): boolean {
  return availabilityTransitions[from].includes(to);
}

export function assertDriverAvailabilityTransition(
  from: DriverAvailabilityStatus,
  to: DriverAvailabilityStatus
): void {
  if (from !== to && !canTransitionDriverAvailability(from, to)) {
    throw new Error(`Invalid Driver availability transition: ${from} -> ${to}`);
  }
}

export function canReleaseDriverAfterJourneyCompletion(input: {
  readonly from: DriverAvailabilityStatus;
  readonly to: DriverAvailabilityStatus;
  readonly journeyCompleted: boolean;
  readonly assignmentCompleted: boolean;
}): boolean {
  return input.from === 'ASSIGNED'
    && input.to === 'AVAILABLE'
    && input.journeyCompleted
    && input.assignmentCompleted;
}

export function canTransitionDriverOffer(from: DriverOfferStatus, to: DriverOfferStatus): boolean {
  return offerTransitions[from].includes(to);
}

export function isLocationFresh(observedAt: Date, now: Date, maxAgeSeconds: number): boolean {
  const ageMs = now.getTime() - observedAt.getTime();
  return ageMs >= 0 && ageMs <= maxAgeSeconds * 1_000;
}

export const DRIVER_ELIGIBILITY_BLOCKERS = [
  'ACCOUNT_NOT_ACTIVE',
  'DRIVER_PROFILE_NOT_APPROVED',
  'COMPLIANCE_NOT_ELIGIBLE',
  'COMPLIANCE_EXPIRED',
  'VEHICLE_NOT_AUTHORISED',
  'VEHICLE_NOT_ELIGIBLE',
  'VEHICLE_ELIGIBILITY_EXPIRED',
  'NOT_AVAILABLE',
  'LOCATION_MISSING',
  'LOCATION_STALE',
  'LOCATION_CONFIDENCE_LOW',
  'ACTIVE_ASSIGNMENT',
  'SCHEDULE_CONFLICT',
  'HARD_REQUIREMENT_MISMATCH'
] as const;
export type DriverEligibilityBlocker = (typeof DRIVER_ELIGIBILITY_BLOCKERS)[number];

export interface DriverDispatchEligibilityInput {
  readonly accountActive: boolean;
  readonly driverProfileApproved: boolean;
  readonly complianceStatus: DriverEligibilityStatus | null;
  readonly complianceValidUntil: Date | null;
  readonly vehicleAuthorised: boolean;
  readonly vehicleStatus: DriverEligibilityStatus | null;
  readonly vehicleValidUntil: Date | null;
  readonly availabilityStatus: DriverAvailabilityStatus;
  readonly locationObservedAt: Date | null;
  readonly locationConfidence: number | null;
  readonly minimumLocationConfidence: number;
  readonly maxLocationAgeSeconds: number;
  readonly hasActiveAssignment: boolean;
  readonly hasScheduleConflict: boolean;
  readonly hardRequirementsMatch: boolean;
}

export interface DriverDispatchEligibilityDecision {
  readonly eligible: boolean;
  readonly blockers: readonly DriverEligibilityBlocker[];
}

export function evaluateDriverDispatchEligibility(
  input: DriverDispatchEligibilityInput,
  now: Date = new Date()
): DriverDispatchEligibilityDecision {
  const blockers: DriverEligibilityBlocker[] = [];
  if (!input.accountActive) blockers.push('ACCOUNT_NOT_ACTIVE');
  if (!input.driverProfileApproved) blockers.push('DRIVER_PROFILE_NOT_APPROVED');
  if (input.complianceStatus !== 'ELIGIBLE') blockers.push('COMPLIANCE_NOT_ELIGIBLE');
  else if (!input.complianceValidUntil || input.complianceValidUntil.getTime() <= now.getTime()) blockers.push('COMPLIANCE_EXPIRED');
  if (!input.vehicleAuthorised) blockers.push('VEHICLE_NOT_AUTHORISED');
  if (input.vehicleStatus !== 'ELIGIBLE') blockers.push('VEHICLE_NOT_ELIGIBLE');
  else if (!input.vehicleValidUntil || input.vehicleValidUntil.getTime() <= now.getTime()) blockers.push('VEHICLE_ELIGIBILITY_EXPIRED');
  if (!['AVAILABLE', 'OFFERED', 'FINISHING_SOON'].includes(input.availabilityStatus)) blockers.push('NOT_AVAILABLE');
  if (!input.locationObservedAt) blockers.push('LOCATION_MISSING');
  else if (!isLocationFresh(input.locationObservedAt, now, input.maxLocationAgeSeconds)) blockers.push('LOCATION_STALE');
  if (input.locationConfidence === null || input.locationConfidence < input.minimumLocationConfidence) blockers.push('LOCATION_CONFIDENCE_LOW');
  if (input.hasActiveAssignment) blockers.push('ACTIVE_ASSIGNMENT');
  if (input.hasScheduleConflict) blockers.push('SCHEDULE_CONFLICT');
  if (!input.hardRequirementsMatch) blockers.push('HARD_REQUIREMENT_MISMATCH');
  return { eligible: blockers.length === 0, blockers };
}
