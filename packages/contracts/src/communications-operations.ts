import type {
  ChannelProviderHealthState,
  CommunicationPolicyClass,
  ContactabilityState,
  ContactCaseQueue,
  Omnichannel
} from '@dazat/domain';

export interface CommunicationsOperationsCapabilitiesProjection {
  readonly notificationPolicyCatalogueModelled: true;
  readonly deliveryAssuranceModelled: true;
  readonly contactCaseContinuityModelled: true;
  readonly providerHealthModelled: true;
  readonly serviceLevelObservationModelled: true;
  readonly scenarioSimulationModelled: true;
  readonly externalProviderExecutionEnabled: false;
  readonly contactCentreStaffMutationEnabled: false;
  readonly personalToolWorkaroundAllowed: false;
  readonly sensitiveContentInAggregateMetrics: false;
  readonly queues: readonly ContactCaseQueue[];
}

export interface NotificationPolicySummaryProjection {
  readonly policyId: string;
  readonly policyKey: string;
  readonly version: number;
  readonly eventType: string;
  readonly purpose: string;
  readonly classification: CommunicationPolicyClass;
  readonly primaryChannel: Omnichannel;
  readonly fallbackChannels: readonly Omnichannel[];
  readonly acknowledgementRequired: boolean;
  readonly currentStateRevalidationRequired: true;
  readonly marketingSeparatedFromOperational: true;
}

export interface ContactCaseSummaryProjection {
  readonly contactCaseId: string;
  readonly status: 'OPEN' | 'WAITING_CUSTOMER' | 'WAITING_INTERNAL' | 'TRANSFER_PENDING' | 'RESOLVED' | 'CLOSED';
  readonly queue: ContactCaseQueue;
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  readonly purpose: string;
  readonly currentContactStatus: ContactabilityState;
  readonly ownerAssigned: boolean;
  readonly nextAction: string;
  readonly attentionAt: string;
  readonly linkedBookingId?: string;
  readonly linkedJourneyId?: string;
  readonly linkedCanonicalCaseType?: string;
  readonly linkedCanonicalCaseId?: string;
  readonly channelHistoryPreserved: true;
  readonly replacesCanonicalDomainCase: false;
  readonly updatedAt: string;
}

export interface ContactCaseListProjection {
  readonly cases: readonly ContactCaseSummaryProjection[];
  readonly contactCentreStaffMutationEnabled: false;
  readonly personalToolWorkaroundAllowed: false;
}

export interface ChannelProviderHealthProjection {
  readonly channel: Omnichannel;
  readonly regionCode: string;
  readonly state: ChannelProviderHealthState;
  readonly observedAt?: string;
  readonly providerConfigured: false;
  readonly providerAcceptanceTreatedAsDelivery: false;
}

export interface CommunicationsOperationsStatusProjection {
  readonly channelHealth: readonly ChannelProviderHealthProjection[];
  readonly openCriticalFailureCaseCount: number;
  readonly pendingCriticalAcknowledgementCount: number;
  readonly aggregateMetricsExcludeSensitiveContent: true;
  readonly recoveryRevalidatesCurrentState: true;
  readonly externalProviderExecutionEnabled: false;
}
