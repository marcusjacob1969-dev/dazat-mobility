export type CoreJourneyMilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';

export interface CoreJourneyMilestone {
  readonly name: 'BOOKING' | 'FARE_AGREEMENT' | 'DISPATCH' | 'DRIVER_ASSIGNED' | 'ARRIVAL' | 'RIDECHECK' | 'JOURNEY' | 'FINANCE';
  readonly status: CoreJourneyMilestoneStatus;
}

export type CoreJourneyNextAction = CoreJourneyMilestone['name'] | 'JOURNEY_CLOSED';

export interface CoreJourneyProgressProjection {
  readonly bookingId: string;
  readonly bookingStatus: string;
  readonly journeyId?: string;
  readonly journeyStatus?: string;
  readonly paymentIntentStatus?: string;
  readonly productionChargingEnabled: false;
  readonly milestones: readonly CoreJourneyMilestone[];
  readonly nextAction: CoreJourneyNextAction;
}
