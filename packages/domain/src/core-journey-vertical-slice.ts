import { assertCanonicalForwardTransition, type BookingStatus } from './booking-status.js';
import { evaluateDriverDispatchEligibility, type DriverDispatchEligibilityInput } from './dispatch.js';
import { evaluateArrivalEvidence, evaluateRideCheckAttempt, canStartJourney, type LocationEvidencePolicy, type LocationObservationInput } from './journey.js';
import { evaluateJourneyCompletion, type CompletionDecisionInput } from './live-journey.js';
import { assertMoneyMinorUnits, assertCurrencyCode, isQuoteUsable } from './pricing.js';

export interface CoreJourneyVerticalSliceInput {
  readonly now: Date;
  readonly quote: { readonly amountMinor: number; readonly currency: string; readonly expiresAt: Date };
  readonly driver: DriverDispatchEligibilityInput;
  readonly pickup: { readonly latitude: number; readonly longitude: number };
  readonly pickupObservation: LocationObservationInput;
  readonly locationPolicy: LocationEvidencePolicy & { readonly arrivalRadiusMetres: number };
  readonly rideCheck: { readonly verifierMatches: boolean; readonly expiresAt: Date };
  readonly completion: CompletionDecisionInput;
}

export interface CoreJourneyVerticalSliceResult {
  readonly completed: boolean;
  readonly bookingStatus: BookingStatus;
  readonly milestones: readonly string[];
  readonly blocker: string | null;
  readonly realPaymentAttempted: false;
  readonly externalProviderContacted: false;
}

export function runProviderDisabledCoreJourney(input: CoreJourneyVerticalSliceInput): CoreJourneyVerticalSliceResult {
  assertMoneyMinorUnits(input.quote.amountMinor);
  assertCurrencyCode(input.quote.currency);
  const milestones: string[] = [];
  let bookingStatus: BookingStatus = 'DRAFT';
  const advance = (next: BookingStatus) => {
    assertCanonicalForwardTransition(bookingStatus, next);
    bookingStatus = next;
    milestones.push(next);
  };
  advance('QUOTE_CREATED');
  if (!isQuoteUsable('OFFERED', input.quote.expiresAt, input.now)) return stopped(bookingStatus, milestones, 'QUOTE_UNUSABLE');
  advance('AWAITING_CONFIRMATION'); advance('CONFIRMED'); advance('READY_FOR_DISPATCH'); advance('SEARCHING_FOR_DRIVER');
  const eligibility = evaluateDriverDispatchEligibility(input.driver, input.now);
  if (!eligibility.eligible) return stopped(bookingStatus, milestones, eligibility.blockers[0] ?? 'NO_ELIGIBLE_DRIVER');
  advance('DRIVER_ASSIGNED'); advance('DRIVER_EN_ROUTE');
  const arrival = evaluateArrivalEvidence(input.pickupObservation, input.pickup, input.locationPolicy);
  if (!arrival.accepted) return stopped(bookingStatus, milestones, arrival.blockers[0] ?? 'OUTSIDE_PICKUP_RADIUS');
  advance('DRIVER_ARRIVED'); advance('AWAITING_RIDECHECK');
  const rideCheck = evaluateRideCheckAttempt({ status: 'PENDING', verifierMatches: input.rideCheck.verifierMatches,
    attemptsUsed: 0, maximumAttempts: 3, expiresAt: input.rideCheck.expiresAt, now: input.now });
  if (!rideCheck.accepted) return stopped(bookingStatus, milestones, `RIDECHECK_${rideCheck.reason}`);
  advance('PASSENGER_VERIFIED');
  if (!canStartJourney({ journeyStatus: 'PASSENGER_VERIFIED', rideCheckStatus: rideCheck.nextStatus,
    assignmentActive: true, assignmentStillEligible: eligibility.eligible, activeOperationalHold: false,
    pickupEvidenceAccepted: arrival.accepted })) return stopped(bookingStatus, milestones, 'JOURNEY_START_BLOCKED');
  advance('IN_PROGRESS'); advance('ARRIVING');
  const completion = evaluateJourneyCompletion(input.completion);
  if (!completion.allowed) return stopped(bookingStatus, milestones, completion.blockers[0] ?? 'COMPLETION_BLOCKED');
  advance('COMPLETED');
  return { completed: true, bookingStatus, milestones, blocker: null, realPaymentAttempted: false, externalProviderContacted: false };
}

function stopped(bookingStatus: BookingStatus, milestones: readonly string[], blocker: string): CoreJourneyVerticalSliceResult {
  return { completed: false, bookingStatus, milestones, blocker, realPaymentAttempted: false, externalProviderContacted: false };
}
