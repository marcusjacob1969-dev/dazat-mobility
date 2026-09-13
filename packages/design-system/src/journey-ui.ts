export type JourneyUiPhase =
  | 'BOOKING'
  | 'DISPATCHING'
  | 'DRIVER_ASSIGNED'
  | 'PICKUP_PROTECTED'
  | 'IN_JOURNEY'
  | 'SUPPORT_REQUIRED'
  | 'PAYMENT_PROVIDER_UNAVAILABLE'
  | 'COMPLETED';

export type JourneyUiTone = 'neutral' | 'positive' | 'warning' | 'danger';

export type JourneyUiState = {
  phase: JourneyUiPhase;
  label: string;
  tone: JourneyUiTone;
  actionable: boolean;
  actionLabel?: string;
};

/**
 * Maps authoritative Core Journey next-action semantics to a presentation state.
 * This is deliberately provider- and mutation-free: clients may render it, but
 * only the canonical backend projection decides what the rider/driver may do.
 */
export function mapCoreJourneyToUiState(input: {
  nextAction: string;
  interruptionReason?: string | null;
  journeyStatus?: string | null;
}): JourneyUiState {
  switch (input.nextAction) {
    case 'SUPPORT_REQUIRED':
      return { phase: 'SUPPORT_REQUIRED', label: 'Support required', tone: 'danger', actionable: true, actionLabel: 'Contact support' };
    case 'PAYMENT_PROVIDER_UNAVAILABLE':
      return { phase: 'PAYMENT_PROVIDER_UNAVAILABLE', label: 'Payment provider unavailable', tone: 'warning', actionable: false };
    case 'JOURNEY_CLOSED':
      return { phase: 'COMPLETED', label: 'Journey completed', tone: 'positive', actionable: false };
    case 'RIDE_CHECK_REQUIRED':
      return { phase: 'PICKUP_PROTECTED', label: 'Complete protected RideCheck', tone: 'warning', actionable: true, actionLabel: 'Complete RideCheck' };
    case 'START_JOURNEY':
      return { phase: 'PICKUP_PROTECTED', label: 'Ready for protected journey start', tone: 'positive', actionable: true, actionLabel: 'Start journey' };
    case 'DRIVER_ASSIGNMENT_REQUIRED':
      return { phase: 'DISPATCHING', label: 'Finding an eligible driver', tone: 'neutral', actionable: false };
    case 'DRIVER_EN_ROUTE':
      return { phase: 'DRIVER_ASSIGNED', label: 'Driver on the way', tone: 'positive', actionable: false };
    case 'JOURNEY_IN_PROGRESS':
      return { phase: 'IN_JOURNEY', label: 'Journey in progress', tone: 'positive', actionable: true, actionLabel: 'View safety controls' };
    default:
      if (input.interruptionReason) {
        return { phase: 'SUPPORT_REQUIRED', label: 'Journey needs support', tone: 'danger', actionable: true, actionLabel: 'Contact support' };
      }
      if (input.journeyStatus === 'COMPLETED') {
        return { phase: 'COMPLETED', label: 'Journey completed', tone: 'positive', actionable: false };
      }
      return { phase: 'BOOKING', label: 'Journey preparing', tone: 'neutral', actionable: false };
  }
}
