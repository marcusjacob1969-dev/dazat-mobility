import type {
  InstitutionalTransportAcceptanceScenario,
  OrganisationPassengerMembershipState
} from '@dazat/domain';

export interface InstitutionalTransportCapabilitiesProjection {
  readonly passengerMembershipStates: readonly OrganisationPassengerMembershipState[];
  readonly serviceTypes: readonly string[];
  readonly seriesChangeScopes: readonly string[];
  readonly bulkImportStates: readonly string[];
  readonly cancellationReasons: readonly string[];
  readonly exceptionTypes: readonly string[];
  readonly conceptualApiPaths: readonly string[];
  readonly conceptualCommands: readonly string[];
  readonly events: readonly string[];
  readonly p0Requirements: readonly string[];
  readonly acceptanceScenarios: readonly InstitutionalTransportAcceptanceScenario[];
  readonly passengerIdentityIndependentFromOrganisation: true;
  readonly bookingAndFundingAuthoritySeparated: true;
  readonly canonicalBookingRequiredPerOccurrence: true;
  readonly accessibilityAndSafeguardingPersistThroughRecurrence: true;
  readonly crossTenantDuplicateDisclosureAllowed: false;
  readonly templateIsCanonicalBooking: false;
  readonly templateReservesDriver: false;
  readonly templateCreatesFinanceLiability: false;
  readonly portalMayRelabelActiveJourneyPassenger: false;
  readonly institutionalEndpointWritesJourneyOrPayment: false;
  readonly institutionalTransportMutationsEnabled: false;
}

export interface InstitutionalTransportExceptionSummaryProjection {
  readonly exceptionId: string;
  readonly exceptionType: string;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'WAITING';
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  readonly nextAction: string;
  readonly attentionAt: string;
  readonly ownerPresent: boolean;
}

export interface InstitutionalTransportContextProjection {
  readonly organisationId: string;
  readonly managedPassengerCount: number;
  readonly activePassengerMembershipCount: number;
  readonly activeFundingAuthorisationCount: number;
  readonly activeBookingTemplateCount: number;
  readonly activeBookingSeriesCount: number;
  readonly futureOccurrenceCount: number;
  readonly passengerNotReadyCount: number;
  readonly openExceptionCount: number;
  readonly exceptions: readonly InstitutionalTransportExceptionSummaryProjection[];
  readonly tenantScopedByAuthenticatedMembership: true;
  readonly minimumTransportDataOnly: true;
  readonly canonicalBookingPerOccurrence: true;
  readonly portalMutationEnabled: false;
  readonly externalExecutionEnabled: false;
}
