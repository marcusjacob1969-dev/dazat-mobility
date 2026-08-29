export type TelemetryConfidenceState = 'LIVE' | 'DELAYED' | 'DEGRADED' | 'STALE' | 'UNKNOWN';

export interface DriverLocationObservationRequest {
  readonly clientObservationId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observedAt: string;
  readonly source: 'DEVICE_GPS' | 'FLEET_TELEMATICS';
  readonly accuracyMetres: number;
  readonly confidence: number;
}

export interface DriverLocationObservationResult {
  readonly observationId: string;
  readonly journeyId: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly telemetryState: TelemetryConfidenceState;
  readonly usableForCriticalDecision: boolean;
}

export interface JourneyCommandResult {
  readonly journeyId: string;
  readonly bookingId: string;
  readonly bookingStatus: string;
  readonly journeyStatus: string;
  readonly aggregateVersion: number;
}

export interface DriverAcknowledgementResult extends JourneyCommandResult {
  readonly assignmentId: string;
  readonly journeyLegId: string;
}

export interface ArrivalResult extends JourneyCommandResult {
  readonly arrivalEvidenceId: string;
  readonly distanceMetres: number;
  readonly arrivalRadiusMetres: number;
}

export interface StartRideCheckResult extends JourneyCommandResult {
  readonly rideCheckSessionId: string;
  readonly method: 'PIN';
  readonly expiresAt: string;
  readonly challengeCode?: string;
  readonly challengeCodeReturnedOnce: boolean;
}

export interface VerifyRideCheckResult {
  readonly journeyId: string;
  readonly rideCheckSessionId: string;
  readonly verified: boolean;
  readonly status: 'PENDING' | 'VERIFIED' | 'LOCKED' | 'EXPIRED';
  readonly attemptsRemaining: number;
  readonly journeyStatus: string;
  readonly bookingStatus: string;
  readonly mismatchCreatesMisconductFinding: false;
}

export interface JourneyLiveProjection {
  readonly journeyId: string;
  readonly bookingId: string;
  readonly journeyStatus: string;
  readonly bookingStatus: string;
  readonly aggregateVersion: number;
  readonly assignmentId: string;
  readonly driverProfileId: string;
  readonly vehicleId: string;
  readonly rideCheckStatus?: string;
  readonly rideCheckSessionId?: string;
  readonly activeOperationalHold: boolean;
  readonly latestDriverLocation?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly observedAt: string;
    readonly receivedAt: string;
    readonly telemetryState: TelemetryConfidenceState;
    readonly accuracyMetres: number;
  };
  readonly projectionGeneratedAt: string;
  readonly requiresAuthoritativeRefreshBeforeMutation: true;
}
