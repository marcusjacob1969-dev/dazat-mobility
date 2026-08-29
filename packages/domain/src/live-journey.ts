import { distanceMetres, evaluateLocationEvidence, type LocationEvidencePolicy, type LocationObservationInput } from './journey.js';

export const JOURNEY_HEALTH_STATES = ['NORMAL', 'ATTENTION', 'AT_RISK', 'INCIDENT'] as const;
export type JourneyHealthState = (typeof JOURNEY_HEALTH_STATES)[number];

export const ROUTE_DEVIATION_SEVERITIES = ['MINOR', 'MODERATE', 'SIGNIFICANT', 'CRITICAL'] as const;
export type RouteDeviationSeverity = (typeof ROUTE_DEVIATION_SEVERITIES)[number];

export const SAFETY_SIGNAL_TYPES = ['SOS', 'SILENT_ASSISTANCE', 'ROUTE_CONCERN'] as const;
export type SafetySignalType = (typeof SAFETY_SIGNAL_TYPES)[number];

export function healthForSafetySignal(signal: SafetySignalType): JourneyHealthState {
  if (signal === 'SOS') return 'INCIDENT';
  if (signal === 'SILENT_ASSISTANCE') return 'AT_RISK';
  return 'ATTENTION';
}

export function silentAssistancePolicy(): {
  readonly doNotAutoCallReporter: true;
  readonly externalDeliveryRequiredForPersistence: false;
} {
  return { doNotAutoCallReporter: true, externalDeliveryRequiredForPersistence: false };
}

export interface MovementPlausibilityDecision {
  readonly plausible: boolean;
  readonly distanceMetres: number;
  readonly elapsedSeconds: number;
  readonly impliedSpeedMetresPerSecond: number | null;
  readonly blocker?: 'OUT_OF_ORDER_LOCATION' | 'IMPOSSIBLE_JUMP';
}

export function evaluateMovementPlausibility(
  previous: Pick<LocationObservationInput, 'latitude' | 'longitude' | 'observedAt'>,
  next: Pick<LocationObservationInput, 'latitude' | 'longitude' | 'observedAt'>,
  maximumPlausibleSpeedMetresPerSecond: number
): MovementPlausibilityDecision {
  const elapsedSeconds = (next.observedAt.getTime() - previous.observedAt.getTime()) / 1_000;
  const travelled = distanceMetres(previous, next);
  if (elapsedSeconds <= 0) {
    return {
      plausible: false,
      distanceMetres: travelled,
      elapsedSeconds,
      impliedSpeedMetresPerSecond: null,
      blocker: 'OUT_OF_ORDER_LOCATION'
    };
  }
  const speed = travelled / elapsedSeconds;
  return speed > maximumPlausibleSpeedMetresPerSecond
    ? { plausible: false, distanceMetres: travelled, elapsedSeconds, impliedSpeedMetresPerSecond: speed, blocker: 'IMPOSSIBLE_JUMP' }
    : { plausible: true, distanceMetres: travelled, elapsedSeconds, impliedSpeedMetresPerSecond: speed };
}

export interface DestinationEvidenceDecision {
  readonly accepted: boolean;
  readonly distanceMetres: number;
  readonly withinRadius: boolean;
  readonly telemetryUsable: boolean;
  readonly blockers: readonly string[];
}

export function evaluateDestinationEvidence(
  observation: LocationObservationInput,
  destination: { readonly latitude: number; readonly longitude: number },
  policy: LocationEvidencePolicy & { readonly destinationRadiusMetres: number }
): DestinationEvidenceDecision {
  const telemetry = evaluateLocationEvidence(observation, policy);
  const distance = distanceMetres(observation, destination);
  const withinRadius = distance <= policy.destinationRadiusMetres;
  return {
    accepted: telemetry.usable && withinRadius,
    distanceMetres: distance,
    withinRadius,
    telemetryUsable: telemetry.usable,
    blockers: [...telemetry.blockers, ...(withinRadius ? [] : ['OUTSIDE_DESTINATION_RADIUS'])]
  };
}

export interface CompletionDecisionInput {
  readonly journeyStatus: string;
  readonly bookingStatus: string;
  readonly assignmentActive: boolean;
  readonly destinationEvidenceAccepted: boolean;
  readonly activeCompletionHold: boolean;
  readonly continuityCaseOpen: boolean;
  readonly handoverRequired: boolean;
  readonly authorisedHandoverRecorded: boolean;
  readonly handoverFailureOpen: boolean;
}

export interface CompletionDecision {
  readonly allowed: boolean;
  readonly blockers: readonly (
    'NOT_ARRIVING' |
    'ASSIGNMENT_NOT_ACTIVE' |
    'DESTINATION_EVIDENCE_REJECTED' |
    'ACTIVE_COMPLETION_HOLD' |
    'CONTINUITY_CASE_OPEN' |
    'HANDOVER_REQUIRED' |
    'HANDOVER_FAILURE_OPEN'
  )[];
}

export function evaluateJourneyCompletion(input: CompletionDecisionInput): CompletionDecision {
  const blockers: CompletionDecision['blockers'][number][] = [];
  if (input.journeyStatus !== 'ARRIVING' || input.bookingStatus !== 'ARRIVING') blockers.push('NOT_ARRIVING');
  if (!input.assignmentActive) blockers.push('ASSIGNMENT_NOT_ACTIVE');
  if (!input.destinationEvidenceAccepted) blockers.push('DESTINATION_EVIDENCE_REJECTED');
  if (input.activeCompletionHold) blockers.push('ACTIVE_COMPLETION_HOLD');
  if (input.continuityCaseOpen) blockers.push('CONTINUITY_CASE_OPEN');
  if (input.handoverFailureOpen) blockers.push('HANDOVER_FAILURE_OPEN');
  if (input.handoverRequired && !input.authorisedHandoverRecorded) blockers.push('HANDOVER_REQUIRED');
  return { allowed: blockers.length === 0, blockers };
}

export type RouteConcernCategory = 'CHECK_ROUTE' | 'WRONG_DESTINATION' | 'FEEL_UNSAFE' | 'UNEXPECTED_STOP' | 'OTHER';

export function routeConcernSeverity(category: RouteConcernCategory): RouteDeviationSeverity {
  if (category === 'FEEL_UNSAFE') return 'CRITICAL';
  if (category === 'WRONG_DESTINATION' || category === 'UNEXPECTED_STOP') return 'SIGNIFICANT';
  return 'MODERATE';
}

export const ROUTE_CONCERN_IS_AUTOMATIC_MISCONDUCT_FINDING = false as const;
