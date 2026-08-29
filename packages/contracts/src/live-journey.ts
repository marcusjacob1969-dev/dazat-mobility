import type { LocationInput } from './booking.js';
import type { JourneyLiveProjection, TelemetryConfidenceState } from './journey.js';

export interface ActiveJourneyLocationRequest {
  readonly clientObservationId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observedAt: string;
  readonly source: 'DEVICE_GPS' | 'FLEET_TELEMATICS';
  readonly accuracyMetres: number;
  readonly confidence: number;
}

export interface ActiveJourneyLocationResult {
  readonly observationId: string;
  readonly journeyId: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly telemetryState: TelemetryConfidenceState;
  readonly usableForMonitoring: boolean;
  readonly movementPlausible: boolean;
  readonly movementBlocker?: 'OUT_OF_ORDER_LOCATION' | 'IMPOSSIBLE_JUMP';
}

export interface RouteChangeRequest {
  readonly requestType: 'ADD_STOP' | 'CHANGE_DESTINATION';
  readonly location: LocationInput;
  readonly expectedJourneyVersion: number;
  readonly reasonCode: 'PASSENGER_REQUEST' | 'ACCESSIBILITY_NEED' | 'OPERATIONAL_NEED' | 'OTHER';
}

export interface RouteChangeResult {
  readonly routeChangeRequestId: string;
  readonly journeyId: string;
  readonly requestType: 'ADD_STOP' | 'CHANGE_DESTINATION';
  readonly status: 'PENDING_POLICY_REVIEW';
  readonly pricingStatus: 'NOT_EVALUATED';
  readonly routeChanged: false;
  readonly message: string;
}

export interface SafetySignalRequest {
  readonly journeyId: string;
  readonly signalType: 'SOS' | 'SILENT_ASSISTANCE' | 'ROUTE_CONCERN';
  readonly routeConcernCategory?: 'CHECK_ROUTE' | 'WRONG_DESTINATION' | 'FEEL_UNSAFE' | 'UNEXPECTED_STOP' | 'OTHER';
}

export interface SafetySignalResult {
  readonly safetyEventId: string;
  readonly journeyId: string;
  readonly signalType: 'SOS' | 'SILENT_ASSISTANCE' | 'ROUTE_CONCERN';
  readonly status: 'OPEN';
  readonly journeyHealth: 'ATTENTION' | 'AT_RISK' | 'INCIDENT';
  readonly doNotAutoCallReporter: boolean;
  readonly persistedBeforeExternalDelivery: true;
  readonly misconductFindingCreated: false;
}

export interface MarkArrivingResult {
  readonly journeyId: string;
  readonly bookingId: string;
  readonly journeyStatus: 'ARRIVING';
  readonly bookingStatus: 'ARRIVING';
  readonly aggregateVersion: number;
  readonly destinationApproachEvidenceId: string;
  readonly distanceMetres: number;
}

export interface CompleteJourneyResult {
  readonly journeyId: string;
  readonly bookingId: string;
  readonly journeyStatus: 'COMPLETED';
  readonly bookingStatus: 'COMPLETED';
  readonly aggregateVersion: number;
  readonly completionEvidenceId: string;
  readonly assignmentStatus: 'COMPLETED';
  readonly driverAvailability: 'AVAILABLE';
  readonly paymentInitiated: false;
}

export interface ActiveJourneyProjection extends JourneyLiveProjection {
  readonly journeyHealth: 'NORMAL' | 'ATTENTION' | 'AT_RISK' | 'INCIDENT';
  readonly latestJourneyEventSequence: number;
  readonly pendingRouteChangeCount: number;
  readonly continuityCaseOpen: boolean;
  readonly completionRequirements: {
    readonly serviceContext: 'STANDARD' | 'SCHOOL' | 'HOSPITAL' | 'SPECIALIST';
    readonly handoverRequired: boolean;
    readonly authorisedHandoverRecorded: boolean;
    readonly handoverFailureOpen: boolean;
  };
  readonly reconnectInstruction: 'AUTHORITATIVE_SNAPSHOT';
}
