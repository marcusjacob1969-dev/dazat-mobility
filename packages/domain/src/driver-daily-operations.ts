export const DRIVER_DAILY_LIFECYCLE = [
  'SECURE_SESSION',
  'SELECT_APPROVED_VEHICLE',
  'EVALUATE_OPERATING_ELIGIBILITY',
  'REVIEW_SCHEDULED_WORK',
  'GO_ONLINE',
  'REVIEW_INFORMED_OFFER',
  'PICKUP',
  'RIDECHECK',
  'ACTIVE_JOURNEY',
  'GOVERNED_COMPLETION',
  'REFRESH_EARNINGS',
  'NEXT_OFFER_OR_BREAK',
  'FINISHING_SOON',
  'OFFLINE_END_SHIFT'
] as const;

export type DriverDailyLifecycleStep = (typeof DRIVER_DAILY_LIFECYCLE)[number];

export const DRIVER_CONNECTIVITY_STATES = ['ONLINE', 'DEGRADED', 'OFFLINE', 'RECOVERING', 'STALE'] as const;
export type DriverConnectivityState = (typeof DRIVER_CONNECTIVITY_STATES)[number];

export const QUEUED_CRITICAL_EVENT_KINDS = [
  'SOS', 'SILENT_ASSISTANCE', 'RIDER_CONDUCT', 'LOCATION_OBSERVATION', 'ARRIVAL_COMMUNICATION_ACK'
] as const;
export type QueuedCriticalEventKind = (typeof QUEUED_CRITICAL_EVENT_KINDS)[number];

export const DRIVER_SUPPORT_CATEGORIES = [
  'SAFETY', 'BREAKDOWN', 'PAYMENTS', 'ACCOUNT', 'COMPLIANCE', 'TECHNICAL', 'PASSENGER', 'FLEET'
] as const;
export type DriverSupportCategory = (typeof DRIVER_SUPPORT_CATEGORIES)[number];

export type DriverSupportRisk = 'ROUTINE' | 'PRIORITY' | 'HIGH_RISK_ACTIVE';
export type SupplySignalKind = 'CURRENT_OBSERVATION' | 'FORECAST';

export type DriverFatigueSafetyState = 'CLEAR' | 'WARNING' | 'REST_REQUIRED' | 'ACTIVE_JOURNEY_HANDOVER_REQUIRED';

export interface DriverFatigueSafetyInput {
  readonly shiftStartedAt: Date | null;
  readonly lastQualifyingRestStartedAt: Date | null;
  readonly lastQualifyingRestEndedAt: Date | null;
  readonly now: Date;
  readonly activeJourney: boolean;
  readonly driverReportedFatigue: boolean;
  readonly drowsinessSignalObserved: boolean;
  readonly policy: {
    readonly warningAfterDutyMinutes: number;
    readonly restRequiredAfterDutyMinutes: number;
    readonly minimumQualifyingRestMinutes: number;
  };
}

export interface DriverFatigueSafetyDecision {
  readonly state: DriverFatigueSafetyState;
  readonly observedDutyMinutes: number | null;
  readonly newOffersAllowed: boolean;
  readonly newJourneyStartAllowed: boolean;
  readonly breakPromptRequired: boolean;
  readonly controlRoomEscalationRequired: boolean;
  readonly activePassengerContinuityRequired: boolean;
  readonly driverFaultFindingCreated: false;
  readonly blockers: readonly string[];
}

export function evaluateDriverFatigueSafety(input: DriverFatigueSafetyInput): DriverFatigueSafetyDecision {
  const { warningAfterDutyMinutes, restRequiredAfterDutyMinutes, minimumQualifyingRestMinutes } = input.policy;
  if (!Number.isSafeInteger(warningAfterDutyMinutes) || warningAfterDutyMinutes <= 0
    || !Number.isSafeInteger(restRequiredAfterDutyMinutes) || restRequiredAfterDutyMinutes <= warningAfterDutyMinutes
    || !Number.isSafeInteger(minimumQualifyingRestMinutes) || minimumQualifyingRestMinutes <= 0) {
    throw new Error('Fatigue policy boundaries must be ordered positive safe integers');
  }
  const nowMs = input.now.getTime();
  if (Number.isNaN(nowMs)) throw new Error('Fatigue assessment time must be valid');
  const restMinutes = input.lastQualifyingRestStartedAt && input.lastQualifyingRestEndedAt
    ? Math.floor((input.lastQualifyingRestEndedAt.getTime() - input.lastQualifyingRestStartedAt.getTime()) / 60_000)
    : null;
  if (restMinutes !== null && restMinutes < 0) throw new Error('Rest evidence cannot end before it starts');
  const qualifyingRestEndedAt = restMinutes !== null && restMinutes >= minimumQualifyingRestMinutes
    ? input.lastQualifyingRestEndedAt : null;
  const effectiveStart = qualifyingRestEndedAt && input.shiftStartedAt
    && qualifyingRestEndedAt > input.shiftStartedAt
    ? qualifyingRestEndedAt : input.shiftStartedAt;
  const observedDutyMinutes = effectiveStart ? Math.floor((nowMs - effectiveStart.getTime()) / 60_000) : null;
  if (observedDutyMinutes !== null && observedDutyMinutes < 0) {
    throw new Error('Fatigue evidence cannot be in the future');
  }
  const evidenceMissing = observedDutyMinutes === null;
  const restRequired = evidenceMissing || input.driverReportedFatigue || input.drowsinessSignalObserved
    || observedDutyMinutes >= restRequiredAfterDutyMinutes;
  const warning = !restRequired && observedDutyMinutes >= warningAfterDutyMinutes;
  const state: DriverFatigueSafetyState = restRequired
    ? input.activeJourney ? 'ACTIVE_JOURNEY_HANDOVER_REQUIRED' : 'REST_REQUIRED'
    : warning ? 'WARNING' : 'CLEAR';
  const blockers: string[] = [];
  if (evidenceMissing) blockers.push('DUTY_TIME_EVIDENCE_MISSING');
  if (input.driverReportedFatigue) blockers.push('DRIVER_REPORTED_FATIGUE');
  if (input.drowsinessSignalObserved) blockers.push('DROWSINESS_SIGNAL_OBSERVED');
  if (observedDutyMinutes !== null && observedDutyMinutes >= restRequiredAfterDutyMinutes) blockers.push('DUTY_LIMIT_REACHED');
  return {
    state,
    observedDutyMinutes,
    newOffersAllowed: !restRequired,
    newJourneyStartAllowed: !restRequired,
    breakPromptRequired: warning || restRequired,
    controlRoomEscalationRequired: state === 'ACTIVE_JOURNEY_HANDOVER_REQUIRED',
    activePassengerContinuityRequired: state === 'ACTIVE_JOURNEY_HANDOVER_REQUIRED',
    driverFaultFindingCreated: false,
    blockers
  };
}

export interface DriverOfferDisclosureInput {
  readonly pickupDistanceMetres: number | null;
  readonly pickupEtaMinutes: number | null;
  readonly serviceCodes: readonly string[];
  readonly journeyContextLabels: readonly string[];
  readonly expectedEarningAmountMinor: number | null;
  readonly expectedEarningCurrency: string | null;
  readonly expectedEarningPolicyVersion: string | null;
  readonly expectedEarningDerivedFromRiderFare: boolean;
  readonly ordinaryDeclinePenaltyApplied: boolean;
}

export interface DriverOfferDisclosureDecision {
  readonly informedChoiceReady: boolean;
  readonly acceptanceAllowed: boolean;
  readonly missingDisclosures: readonly string[];
  readonly blindOfferProhibited: true;
  readonly ordinaryDeclinePenaltyApplied: false;
  readonly expectedEarningDerivedFromRiderFare: false;
}

export function evaluateDriverOfferDisclosure(input: DriverOfferDisclosureInput): DriverOfferDisclosureDecision {
  const missing: string[] = [];
  if (input.pickupDistanceMetres === null || !Number.isFinite(input.pickupDistanceMetres) || input.pickupDistanceMetres < 0) {
    missing.push('PICKUP_DISTANCE');
  }
  if (input.pickupEtaMinutes === null || !Number.isFinite(input.pickupEtaMinutes) || input.pickupEtaMinutes < 0) {
    missing.push('PICKUP_ETA');
  }
  if (!input.serviceCodes.map((value) => value.trim()).filter(Boolean).length) missing.push('SERVICE_TYPE');
  if (!input.journeyContextLabels.map((value) => value.trim()).filter(Boolean).length) missing.push('JOURNEY_CONTEXT');
  if (
    input.expectedEarningAmountMinor === null
    || !Number.isSafeInteger(input.expectedEarningAmountMinor)
    || input.expectedEarningAmountMinor < 0
    || !input.expectedEarningCurrency
    || !/^[A-Z]{3}$/.test(input.expectedEarningCurrency)
    || !input.expectedEarningPolicyVersion?.trim()
  ) missing.push('EXPECTED_OR_ESTIMATED_EARNING');
  if (input.expectedEarningDerivedFromRiderFare) missing.push('INDEPENDENT_DRIVER_EARNING_BASIS');
  if (input.ordinaryDeclinePenaltyApplied) missing.push('NON_PUNITIVE_ORDINARY_DECLINE');
  const informedChoiceReady = missing.length === 0;
  return {
    informedChoiceReady,
    acceptanceAllowed: informedChoiceReady,
    missingDisclosures: missing,
    blindOfferProhibited: true,
    ordinaryDeclinePenaltyApplied: false,
    expectedEarningDerivedFromRiderFare: false
  };
}

export interface ConnectivityAssessmentInput {
  readonly networkReachable: boolean;
  readonly lastServerSyncAt: Date | null;
  readonly now: Date;
  readonly maximumFreshAgeMs: number;
  readonly authoritativeSnapshotApplied: boolean;
  readonly queuedCriticalEventCount: number;
}

export interface ConnectivityAssessment {
  readonly state: DriverConnectivityState;
  readonly authoritativeSnapshotRequired: boolean;
  readonly speculativeStateMayBeTrusted: false;
  readonly queuedCriticalEventsExecutedByReconciliation: false;
  readonly queuedCriticalEventCount: number;
}

export function assessDriverConnectivity(input: ConnectivityAssessmentInput): ConnectivityAssessment {
  if (!Number.isSafeInteger(input.queuedCriticalEventCount) || input.queuedCriticalEventCount < 0) {
    throw new Error('Queued critical event count must be a non-negative safe integer');
  }
  if (!Number.isFinite(input.maximumFreshAgeMs) || input.maximumFreshAgeMs <= 0) {
    throw new Error('Connectivity freshness window must be positive');
  }
  const age = input.lastServerSyncAt ? input.now.getTime() - input.lastServerSyncAt.getTime() : Number.POSITIVE_INFINITY;
  const stale = age < 0 || age > input.maximumFreshAgeMs;
  const state: DriverConnectivityState = !input.networkReachable
    ? 'OFFLINE'
    : !input.authoritativeSnapshotApplied
      ? 'RECOVERING'
      : stale
        ? 'STALE'
        : input.queuedCriticalEventCount > 0 ? 'DEGRADED' : 'ONLINE';
  return {
    state,
    authoritativeSnapshotRequired: state === 'RECOVERING' || state === 'STALE' || state === 'OFFLINE',
    speculativeStateMayBeTrusted: false,
    queuedCriticalEventsExecutedByReconciliation: false,
    queuedCriticalEventCount: input.queuedCriticalEventCount
  };
}

export function queuedCriticalEventSubmissionRoute(kind: QueuedCriticalEventKind): string {
  const routes: Readonly<Record<QueuedCriticalEventKind, string>> = {
    SOS: 'CANONICAL_SAFETY_COMMAND',
    SILENT_ASSISTANCE: 'CANONICAL_SAFETY_COMMAND',
    RIDER_CONDUCT: 'CANONICAL_RIDER_CONDUCT_COMMAND',
    LOCATION_OBSERVATION: 'AUTHORITATIVE_LOCATION_OBSERVATION_COMMAND',
    ARRIVAL_COMMUNICATION_ACK: 'COMMUNICATION_ACKNOWLEDGEMENT_COMMAND'
  };
  return routes[kind];
}

export function evaluateDriverSupportRouting(input: {
  readonly category: DriverSupportCategory;
  readonly activeJourney: boolean;
  readonly immediateDanger: boolean;
  readonly serviceContinuityAtRisk: boolean;
}): { readonly risk: DriverSupportRisk; readonly humanEscalationRequired: boolean; readonly externalServiceContacted: false } {
  const highRisk = input.immediateDanger
    || (input.activeJourney && ['SAFETY', 'BREAKDOWN', 'PASSENGER'].includes(input.category))
    || input.serviceContinuityAtRisk;
  const priority = !highRisk && input.activeJourney;
  return {
    risk: highRisk ? 'HIGH_RISK_ACTIVE' : priority ? 'PRIORITY' : 'ROUTINE',
    humanEscalationRequired: highRisk,
    externalServiceContacted: false
  };
}

export function supplySignalMayBePublished(input: {
  readonly kind: SupplySignalKind;
  readonly observedOrForecastAt: Date;
  readonly evidenceReferences: readonly string[];
  readonly capabilityCode: string;
  readonly guaranteedEarningsClaim: boolean;
}): boolean {
  return ['CURRENT_OBSERVATION', 'FORECAST'].includes(input.kind)
    && !Number.isNaN(input.observedOrForecastAt.getTime())
    && input.evidenceReferences.some((value) => value.trim().length > 0)
    && input.capabilityCode.trim().length > 0
    && !input.guaranteedEarningsClaim;
}

export function homewardPreferenceMayInfluenceRanking(input: {
  readonly driverFinishingSoon: boolean;
  readonly hardEligibilityPassed: boolean;
  readonly passengerAttributeUsed: boolean;
  readonly guaranteedTripClaimed: boolean;
  readonly preferenceExpired: boolean;
}): boolean {
  return input.driverFinishingSoon
    && input.hardEligibilityPassed
    && !input.passengerAttributeUsed
    && !input.guaranteedTripClaimed
    && !input.preferenceExpired;
}

export function arrivalCommunicationPlanIsSafe(input: {
  readonly authoritativeBookingPickupUsed: boolean;
  readonly passengerGpsAssumedAsPickup: boolean;
  readonly recipientRolesScoped: boolean;
  readonly directContactDetailsExposed: boolean;
}): boolean {
  return input.authoritativeBookingPickupUsed
    && !input.passengerGpsAssumedAsPickup
    && input.recipientRolesScoped
    && !input.directContactDetailsExposed;
}

export const BLIND_DRIVER_OFFERS_PERMITTED = false as const;
export const ORDINARY_OFFLINE_APP_LOCATION_COLLECTION_PERMITTED = false as const;
export const DEMAND_FORECAST_GUARANTEES_EARNINGS = false as const;
export const VOICE_INPUT_BYPASSES_BACKEND_VALIDATION = false as const;
export const DRIVER_BREAK_IS_MISCONDUCT = false as const;
export const DRIVER_FINISHING_SOON_IS_MISCONDUCT = false as const;
