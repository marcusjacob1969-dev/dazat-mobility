export type CoreJourneyMilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface CoreJourneyMilestone {
  readonly name: 'BOOKING' | 'FARE_AGREEMENT' | 'DISPATCH' | 'DRIVER_ASSIGNED' | 'ARRIVAL' | 'RIDECHECK' | 'JOURNEY' | 'FINANCE';
  readonly status: CoreJourneyMilestoneStatus;
}

export type CoreJourneyDisposition = 'ACTIVE' | 'CLOSED' | 'SUPPORT_REQUIRED';

export type CoreJourneyNextAction = CoreJourneyMilestone['name'] | 'JOURNEY_CLOSED' | 'SUPPORT_REQUIRED';

export interface CoreJourneyProgressProjection {
  readonly bookingId: string;
  readonly bookingStatus: BookingStatus;
  readonly journeyId?: string;
  readonly journeyStatus?: string;
  readonly paymentIntentStatus?: string;
  readonly disposition: CoreJourneyDisposition;
  readonly interruptionReason?: string;
  readonly productionChargingEnabled: false;
  readonly milestones: readonly CoreJourneyMilestone[];
  readonly nextAction: CoreJourneyNextAction;
}
import type { BookingStatus } from '@dazat/domain';
