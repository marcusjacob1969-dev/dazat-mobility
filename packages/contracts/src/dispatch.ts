import type { LocationInput } from './booking.js';
import type { DriverOfferDisclosureProjection } from './driver-daily-operations.js';

export interface DriverEligibilitySummary {
  readonly driverProfileId: string;
  readonly vehicleId?: string;
  readonly eligible: boolean;
  readonly blockers: readonly string[];
  readonly complianceValidUntil?: string;
  readonly vehicleValidUntil?: string;
}

export interface SetDriverAvailabilityRequest {
  readonly status: 'AVAILABLE' | 'OFFLINE' | 'BREAK' | 'FINISHING_SOON';
  readonly regionCode?: string;
  readonly vehicleId?: string;
  readonly location?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly observedAt: string;
    readonly source: 'DEVICE_GPS' | 'FLEET_TELEMATICS';
    readonly confidence: number;
  };
}

export interface DriverAvailabilitySummary {
  readonly driverProfileId: string;
  readonly status: string;
  readonly version: number;
  readonly regionCode?: string;
  readonly vehicleId?: string;
  readonly locationObservedAt?: string;
  readonly eligibility: DriverEligibilitySummary;
}

export interface StartDispatchResult {
  readonly bookingId: string;
  readonly bookingStatus: 'SEARCHING_FOR_DRIVER' | 'NO_ELIGIBLE_DRIVER';
  readonly dispatchAttemptId: string;
  readonly dispatchStatus: 'OFFERING' | 'NO_ELIGIBLE_DRIVER';
  readonly eligibleCandidateCount: number;
  readonly offeredDriverCount: number;
}

export interface DriverOfferSummary {
  readonly offerId: string;
  readonly dispatchAttemptId: string;
  readonly bookingId: string;
  readonly status: string;
  readonly expiresAt: string;
  readonly regionCode: string;
  readonly pickup: LocationInput;
  readonly dropoff: LocationInput;
  readonly scheduledFor?: string;
  readonly provisionalPickupDistanceMetres?: number;
  readonly disclosure: DriverOfferDisclosureProjection;
}

export interface AcceptDriverOfferResult {
  readonly offerId: string;
  readonly assignmentId: string;
  readonly bookingId: string;
  readonly bookingStatus: 'DRIVER_ASSIGNED';
  readonly driverProfileId: string;
  readonly vehicleId: string;
  readonly assignedAt: string;
}

export interface DeclineDriverOfferResult {
  readonly offerId: string;
  readonly status: 'DECLINED';
  readonly declinedAt: string;
  readonly acceptanceRatePenaltyApplied: false;
}

export interface BookingDispatchProjection {
  readonly bookingId: string;
  readonly bookingStatus: string;
  readonly dispatchStatus?: string;
  readonly driverAssigned: boolean;
  readonly assignmentId?: string;
  readonly driverProfileId?: string;
  readonly vehicleId?: string;
  readonly assignedAt?: string;
}
