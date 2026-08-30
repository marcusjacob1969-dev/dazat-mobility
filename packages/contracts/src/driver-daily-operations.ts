export type DriverConnectivityState = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'RECOVERING' | 'STALE';
export type QueuedCriticalEventKind = 'SOS' | 'SILENT_ASSISTANCE' | 'RIDER_CONDUCT' | 'LOCATION_OBSERVATION' | 'ARRIVAL_COMMUNICATION_ACK';
export type DriverSupportCategory = 'SAFETY' | 'BREAKDOWN' | 'PAYMENTS' | 'ACCOUNT' | 'COMPLIANCE' | 'TECHNICAL' | 'PASSENGER' | 'FLEET';

export interface DriverScheduledWorkSummary {
  readonly commitmentId: string;
  readonly bookingId: string;
  readonly scheduledFor: string;
  readonly protectedFrom: string;
  readonly protectedUntil: string;
  readonly serviceCode: string;
  readonly status: 'ACCEPTED' | 'CANCELLED' | 'COMPLETED' | 'MISSED';
}

export interface DriverDailyOperationsProjection {
  readonly driverProfileId: string;
  readonly availabilityStatus: 'OFFLINE' | 'AVAILABLE' | 'OFFERED' | 'ASSIGNED' | 'BREAK' | 'FINISHING_SOON';
  readonly availabilityVersion: number;
  readonly shiftId?: string;
  readonly shiftStartedAt?: string;
  readonly selectedVehicleId?: string;
  readonly regionCode?: string;
  readonly operatingEligibilityEvaluatedSeparately: true;
  readonly scheduledWork: readonly DriverScheduledWorkSummary[];
  readonly activeAssignmentId?: string;
  readonly activeJourneyId?: string;
  readonly activeJourneyVersion?: number;
  readonly openOfferCount: number;
  readonly postedEarningCount: number;
  readonly openSupportCaseCount: number;
  readonly connectivity: {
    readonly state: DriverConnectivityState;
    readonly lastReconciledAt?: string;
    readonly authoritativeSnapshotRequired: boolean;
    readonly speculativeStateMayBeTrusted: false;
  };
  readonly ordinaryAppLocationCollectionActive: boolean;
  readonly breakIsMisconduct: false;
  readonly finishingSoonIsMisconduct: false;
  readonly voiceReadoutConfigured: false;
  readonly carPlayConfigured: false;
  readonly androidAutoConfigured: false;
  readonly voiceInputBypassesBackendValidation: false;
  readonly source: 'AUTHORITATIVE_CURRENT_PROJECTION';
  readonly evaluatedAt: string;
}

export interface DriverOfferDisclosureProjection {
  readonly serviceCodes: readonly string[];
  readonly journeyContextLabels: readonly string[];
  readonly pickupDistanceMetres?: number;
  readonly pickupEta: {
    readonly status: 'AVAILABLE' | 'UNAVAILABLE_ROUTE_ESTIMATE_NOT_CONFIGURED';
    readonly minutes?: number;
  };
  readonly expectedEarning: {
    readonly status: 'VERIFIED_ESTIMATE' | 'UNAVAILABLE_FINANCE_POLICY_NOT_APPROVED';
    readonly amountMinor?: number;
    readonly currency?: string;
    readonly policyVersion?: string;
    readonly derivedFromRiderFare: false;
  };
  readonly informedChoiceReady: boolean;
  readonly acceptanceAllowed: boolean;
  readonly missingDisclosures: readonly string[];
  readonly blindOfferProhibited: true;
  readonly ordinaryDeclinePenaltyApplied: false;
}

export interface ConnectivityReconciliationRequest {
  readonly clientObservationId: string;
  readonly networkReachable: boolean;
  readonly observedAt: string;
  readonly lastServerSyncAt?: string;
  readonly knownAvailabilityVersion?: number;
  readonly knownActiveJourneyId?: string;
  readonly knownActiveJourneyVersion?: number;
  readonly queuedCriticalEvents: readonly {
    readonly clientEventId: string;
    readonly kind: QueuedCriticalEventKind;
    readonly observedAt: string;
  }[];
}

export interface ConnectivityReconciliationProjection {
  readonly reconciliationId: string;
  readonly state: DriverConnectivityState;
  readonly authoritativeAvailabilityStatus: string;
  readonly authoritativeAvailabilityVersion: number;
  readonly authoritativeActiveJourneyId?: string;
  readonly authoritativeActiveJourneyVersion?: number;
  readonly authoritativeSnapshotRequired: boolean;
  readonly speculativeStateMayBeTrusted: false;
  readonly queuedCriticalEventsExecuted: false;
  readonly queuedCriticalEvents: readonly {
    readonly clientEventId: string;
    readonly kind: QueuedCriticalEventKind;
    readonly submissionRoute: string;
    readonly status: 'REQUIRES_CANONICAL_SUBMISSION';
  }[];
  readonly reconciledAt: string;
}

export interface OpenDriverSupportCaseRequest {
  readonly category: DriverSupportCategory;
  readonly summaryReference: string;
  readonly journeyId?: string;
  readonly bookingId?: string;
  readonly vehicleId?: string;
  readonly immediateDanger: boolean;
  readonly serviceContinuityAtRisk: boolean;
}

export interface DriverSupportCaseProjection {
  readonly supportCaseId: string;
  readonly category: DriverSupportCategory;
  readonly risk: 'ROUTINE' | 'PRIORITY' | 'HIGH_RISK_ACTIVE';
  readonly status: 'OPEN' | 'HUMAN_ESCALATION_REQUIRED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  readonly journeyId?: string;
  readonly bookingId?: string;
  readonly vehicleId?: string;
  readonly humanEscalationRequired: boolean;
  readonly externalServiceContacted: false;
  readonly createdAt: string;
}

export interface DriverSupplySignalProjection {
  readonly observationId: string;
  readonly kind: 'CURRENT_OBSERVATION' | 'FORECAST';
  readonly regionCode: string;
  readonly capabilityCode: string;
  readonly demandCount: number;
  readonly eligibleSupplyCount: number;
  readonly observedOrForecastAt: string;
  readonly confidence: number;
  readonly guaranteedEarnings: false;
  readonly evidenceBacked: true;
}

export interface DriverSupplyProjection {
  readonly regionCode: string;
  readonly signals: readonly DriverSupplySignalProjection[];
  readonly currentAndForecastKeptSeparate: true;
  readonly supplyMeasuredByCapability: true;
  readonly guaranteedEarnings: false;
}

export interface ArrivalCommunicationPlanProjection {
  readonly bookingId: string;
  readonly planStatus: 'CONFIGURED' | 'NOT_CONFIGURED';
  readonly version?: number;
  readonly pickup: {
    readonly snapshotId: string;
    readonly displayLabel: string;
    readonly structuredAddress: Readonly<Record<string, string>>;
  };
  readonly passengerGpsAssumedAsPickup: false;
  readonly channels: readonly ('IN_APP' | 'PUSH' | 'SMS' | 'TELEPHONE' | 'CARER_OR_RECEPTION')[];
  readonly recipientRoles: readonly string[];
  readonly driverInstructions: readonly string[];
  readonly directContactDetailsExposed: false;
  readonly communicationExecutionEnabled: false;
}
