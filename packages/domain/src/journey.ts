export const JOURNEY_STATUSES = [
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'AWAITING_RIDECHECK',
  'PASSENGER_VERIFIED',
  'IN_PROGRESS'
] as const;

export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

const journeyTransitions: Readonly<Record<JourneyStatus, readonly JourneyStatus[]>> = {
  ASSIGNED: ['EN_ROUTE'],
  EN_ROUTE: ['ARRIVED'],
  ARRIVED: ['AWAITING_RIDECHECK'],
  AWAITING_RIDECHECK: ['PASSENGER_VERIFIED'],
  PASSENGER_VERIFIED: ['IN_PROGRESS'],
  IN_PROGRESS: []
};

export function canTransitionJourney(from: JourneyStatus, to: JourneyStatus): boolean {
  return journeyTransitions[from].includes(to);
}

export function assertJourneyTransition(from: JourneyStatus, to: JourneyStatus): void {
  if (!canTransitionJourney(from, to)) {
    throw new Error(`Invalid Journey transition: ${from} -> ${to}`);
  }
}

export const TELEMETRY_CONFIDENCE_STATES = ['LIVE', 'DELAYED', 'DEGRADED', 'STALE', 'UNKNOWN'] as const;
export type TelemetryConfidenceState = (typeof TELEMETRY_CONFIDENCE_STATES)[number];

export interface LocationObservationInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly observedAt: Date;
  readonly receivedAt: Date;
  readonly accuracyMetres: number;
  readonly confidence: number;
}

export interface LocationEvidencePolicy {
  readonly maxAgeSeconds: number;
  readonly maximumFutureSkewSeconds: number;
  readonly maximumAccuracyMetres: number;
  readonly minimumConfidence: number;
}

export interface LocationEvidenceDecision {
  readonly usable: boolean;
  readonly state: TelemetryConfidenceState;
  readonly blockers: readonly ('LOCATION_IN_FUTURE' | 'LOCATION_STALE' | 'LOCATION_ACCURACY_LOW' | 'LOCATION_CONFIDENCE_LOW')[];
  readonly ageSeconds: number;
}

export function evaluateLocationEvidence(
  observation: LocationObservationInput,
  policy: LocationEvidencePolicy
): LocationEvidenceDecision {
  const blockers: LocationEvidenceDecision['blockers'][number][] = [];
  const ageSeconds = (observation.receivedAt.getTime() - observation.observedAt.getTime()) / 1_000;
  if (ageSeconds < -policy.maximumFutureSkewSeconds) blockers.push('LOCATION_IN_FUTURE');
  if (ageSeconds > policy.maxAgeSeconds) blockers.push('LOCATION_STALE');
  if (!Number.isFinite(observation.accuracyMetres) || observation.accuracyMetres < 0 || observation.accuracyMetres > policy.maximumAccuracyMetres) {
    blockers.push('LOCATION_ACCURACY_LOW');
  }
  if (!Number.isFinite(observation.confidence) || observation.confidence < policy.minimumConfidence || observation.confidence > 1) {
    blockers.push('LOCATION_CONFIDENCE_LOW');
  }

  let state: TelemetryConfidenceState = 'LIVE';
  if (blockers.includes('LOCATION_IN_FUTURE') || blockers.includes('LOCATION_STALE')) state = 'STALE';
  else if (blockers.length) state = 'DEGRADED';
  else if (ageSeconds > policy.maxAgeSeconds / 2) state = 'DELAYED';

  return { usable: blockers.length === 0, state, blockers, ageSeconds };
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceMetres(
  from: Pick<LocationObservationInput, 'latitude' | 'longitude'>,
  to: { readonly latitude: number; readonly longitude: number }
): number {
  const earthRadiusMetres = 6_371_000;
  const latitudeDelta = degreesToRadians(to.latitude - from.latitude);
  const longitudeDelta = degreesToRadians(to.longitude - from.longitude);
  const fromLatitude = degreesToRadians(from.latitude);
  const toLatitude = degreesToRadians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMetres * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface ArrivalEvidenceDecision extends LocationEvidenceDecision {
  readonly distanceMetres: number;
  readonly withinArrivalRadius: boolean;
  readonly accepted: boolean;
}

export function evaluateArrivalEvidence(
  observation: LocationObservationInput,
  pickup: { readonly latitude: number; readonly longitude: number },
  policy: LocationEvidencePolicy & { readonly arrivalRadiusMetres: number }
): ArrivalEvidenceDecision {
  const location = evaluateLocationEvidence(observation, policy);
  const distance = distanceMetres(observation, pickup);
  const withinArrivalRadius = distance <= policy.arrivalRadiusMetres;
  return {
    ...location,
    distanceMetres: distance,
    withinArrivalRadius,
    accepted: location.usable && withinArrivalRadius
  };
}

export const RIDECHECK_STATUSES = ['PENDING', 'VERIFIED', 'LOCKED', 'EXPIRED', 'SUPERSEDED'] as const;
export type RideCheckStatus = (typeof RIDECHECK_STATUSES)[number];

export interface RideCheckAttemptDecision {
  readonly accepted: boolean;
  readonly nextStatus: RideCheckStatus;
  readonly attemptsRemaining: number;
  readonly reason: 'VERIFIED' | 'MISMATCH' | 'ATTEMPTS_EXHAUSTED' | 'EXPIRED' | 'NOT_PENDING';
}

export function evaluateRideCheckAttempt(input: {
  readonly status: RideCheckStatus;
  readonly verifierMatches: boolean;
  readonly attemptsUsed: number;
  readonly maximumAttempts: number;
  readonly expiresAt: Date;
  readonly now: Date;
}): RideCheckAttemptDecision {
  const remainingBeforeAttempt = Math.max(0, input.maximumAttempts - input.attemptsUsed);
  if (input.status !== 'PENDING') {
    return { accepted: false, nextStatus: input.status, attemptsRemaining: remainingBeforeAttempt, reason: 'NOT_PENDING' };
  }
  if (input.expiresAt.getTime() <= input.now.getTime()) {
    return { accepted: false, nextStatus: 'EXPIRED', attemptsRemaining: remainingBeforeAttempt, reason: 'EXPIRED' };
  }
  if (input.verifierMatches) {
    return { accepted: true, nextStatus: 'VERIFIED', attemptsRemaining: Math.max(0, remainingBeforeAttempt - 1), reason: 'VERIFIED' };
  }
  const attemptsRemaining = Math.max(0, input.maximumAttempts - input.attemptsUsed - 1);
  return attemptsRemaining === 0
    ? { accepted: false, nextStatus: 'LOCKED', attemptsRemaining, reason: 'ATTEMPTS_EXHAUSTED' }
    : { accepted: false, nextStatus: 'PENDING', attemptsRemaining, reason: 'MISMATCH' };
}

export function canStartJourney(input: {
  readonly journeyStatus: JourneyStatus;
  readonly rideCheckStatus: RideCheckStatus | null;
  readonly assignmentActive: boolean;
  readonly assignmentStillEligible: boolean;
  readonly activeOperationalHold: boolean;
  readonly pickupEvidenceAccepted: boolean;
}): boolean {
  return input.journeyStatus === 'PASSENGER_VERIFIED'
    && input.rideCheckStatus === 'VERIFIED'
    && input.assignmentActive
    && input.assignmentStillEligible
    && !input.activeOperationalHold
    && input.pickupEvidenceAccepted;
}
