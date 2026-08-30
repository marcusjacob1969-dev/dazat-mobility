import type {
  CommunicationAcceptanceScenario,
  CommunicationConceptualApiOperation,
  CommunicationLaunchGate,
  CommunicationP0Requirement,
  CommunicationRecipientRole,
  CommunicationSourceDomain,
  CriticalCommunicationEventType
} from '@dazat/domain';

export interface CommunicationsClosureCapabilitiesProjection {
  readonly canonicalRequestContractModelled: true;
  readonly versionedEventEnvelopeModelled: true;
  readonly recipientPermissionMatrixModelled: true;
  readonly orderedDeliveryDecisionModelled: true;
  readonly degradedModeContractModelled: true;
  readonly acceptanceCatalogueModelled: true;
  readonly launchGateCatalogueModelled: true;
  readonly criticalEventTypes: readonly CriticalCommunicationEventType[];
  readonly conceptualApiOperations: readonly CommunicationConceptualApiOperation[];
  readonly p0Requirements: readonly CommunicationP0Requirement[];
  readonly sourceDomains: readonly CommunicationSourceDomain[];
  readonly recipientRoles: readonly CommunicationRecipientRole[];
  readonly acceptanceScenarios: readonly CommunicationAcceptanceScenario[];
  readonly launchGates: readonly CommunicationLaunchGate[];
  readonly communicationsInventsBusinessState: false;
  readonly endpointCallGrantsDomainAuthority: false;
  readonly unmanagedProviderBypassAllowed: false;
  readonly voiceAiHighRiskDecisionAllowed: false;
  readonly externalProviderExecutionEnabled: false;
  readonly communicationsClosureMutationsEnabled: false;
  readonly conceptualCommandMutationsImplemented: false;
}

export interface CommunicationsClosureStatusProjection {
  readonly communicationRequestCount: number;
  readonly canonicalContractCount: number;
  readonly suppressedStaleRequestCount: number;
  readonly communicationCreatedCount: number;
  readonly pendingOrEscalatedCount: number;
  readonly recipientScoped: true;
  readonly authoritativeEventRequired: true;
  readonly rolePermissionRequired: true;
  readonly priorityGrantsAdditionalDataAccess: false;
  readonly providerAcceptanceTreatedAsDelivery: false;
  readonly externalProviderExecutionEnabled: false;
}

export interface CommunicationLaunchGateProjection {
  readonly gate: CommunicationLaunchGate;
  readonly status: 'PASS' | 'FAIL' | 'NOT_TESTED';
  readonly evidenceReference?: string;
}

export interface CommunicationsLaunchReadinessProjection {
  readonly gates: readonly CommunicationLaunchGateProjection[];
  readonly evidenceComplete: boolean;
  readonly productionPoliciesApproved: false;
  readonly providerSelectedAndContracted: false;
  readonly operationsStaffingApproved: false;
  readonly privacyRetentionApproved: false;
  readonly pilotReady: false;
  readonly providerExecutionMayBeEnabledAtThisCheckpoint: false;
}
