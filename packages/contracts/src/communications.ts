import type {
  ChannelHealthState,
  CommunicationChannel,
  CommunicationPriority,
  CommunicationPurpose,
  MessageDeliveryState
} from '@dazat/domain';

export interface CommunicationSummaryProjection {
  readonly communicationId: string;
  readonly purpose: CommunicationPurpose;
  readonly priority: CommunicationPriority;
  readonly recipientRole: string;
  readonly status: 'QUEUED' | 'DELIVERY_PENDING' | 'DELIVERED' | 'ACK_REQUIRED' | 'ACKNOWLEDGED' | 'FAILED' | 'EXPIRED' | 'SUPPRESSED';
  readonly templateKey: string;
  readonly templateVersion: number;
  readonly sourceAggregateType: string;
  readonly sourceAggregateId: string;
  readonly sourceAggregateVersion: number;
  readonly acknowledgementRequired: boolean;
  readonly acknowledgementDeadline?: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export interface MessageDeliveryProjection {
  readonly deliveryId: string;
  readonly channel: CommunicationChannel;
  readonly attemptNumber: number;
  readonly state: MessageDeliveryState;
  readonly contactHint?: string;
  readonly providerReferenceStored: boolean;
  readonly failureCode?: string;
  readonly occurredAt: string;
  readonly externalProviderExecutionEnabled: false;
}

export interface CommunicationProjection extends CommunicationSummaryProjection {
  readonly deliveries: readonly MessageDeliveryProjection[];
  readonly acknowledgedAt?: string;
  readonly acknowledgementEscalation: 'NOT_REQUIRED' | 'WAITING' | 'ACKNOWLEDGED' | 'HUMAN_ESCALATION_REQUIRED';
  readonly personalContactDetailsExposed: false;
  readonly marketingSeparatedFromOperational: true;
  readonly staleDeliverySuppressionEnabled: true;
}

export interface CommunicationInboxProjection {
  readonly communications: readonly CommunicationSummaryProjection[];
  readonly channelHealth: readonly {
    readonly channel: CommunicationChannel;
    readonly state: ChannelHealthState;
    readonly observedAt?: string;
  }[];
  readonly degradedModeExplicit: true;
  readonly providerExecutionEnabled: false;
}

export interface AcknowledgeCommunicationRequest {
  readonly clientAcknowledgementId: string;
  readonly acknowledgedAt: string;
}

export interface CommunicationAcknowledgementProjection {
  readonly communicationId: string;
  readonly acknowledgementId: string;
  readonly status: 'ACKNOWLEDGED';
  readonly acknowledgedAt: string;
  readonly repeatedAcknowledgement: boolean;
}

export interface InternalCommunicationRequest {
  readonly purpose: CommunicationPurpose;
  readonly priority: CommunicationPriority;
  readonly recipientPersonId: string;
  readonly recipientRole: string;
  readonly templateKey: string;
  readonly templateVersion: number;
  readonly sourceAggregateType: string;
  readonly sourceAggregateId: string;
  readonly sourceAggregateVersion: number;
  readonly currentAggregateVersion: number;
  readonly requestedChannels: readonly CommunicationChannel[];
  readonly acknowledgementRequired: boolean;
  readonly acknowledgementDeadline?: string;
  readonly expiresAt?: string;
  readonly silentAssistance: boolean;
  readonly quietHoursActive: boolean;
}
