export const COMMUNICATION_PURPOSES = [
  'BOOKING_OPERATIONAL',
  'JOURNEY_OPERATIONAL',
  'SAFETY',
  'SCHOOL_SAFEGUARDING',
  'PAYMENT',
  'ACCOUNT_SECURITY',
  'DRIVER_OPERATIONS',
  'SUPPORT',
  'BUSINESS',
  'MARKETING'
] as const;
export type CommunicationPurpose = (typeof COMMUNICATION_PURPOSES)[number];

export const COMMUNICATION_PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;
export type CommunicationPriority = (typeof COMMUNICATION_PRIORITIES)[number];

export const COMMUNICATION_CHANNELS = [
  'IN_APP',
  'PUSH',
  'SMS',
  'EMAIL',
  'VOICE_CALL',
  'MASKED_CALL',
  'PROTECTED_CHAT',
  'AUTHENTICATED_PORTAL'
] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const MESSAGE_DELIVERY_STATES = [
  'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'EXPIRED', 'UNKNOWN', 'SUPPRESSED_STALE'
] as const;
export type MessageDeliveryState = (typeof MESSAGE_DELIVERY_STATES)[number];

export const CHANNEL_HEALTH_STATES = ['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN'] as const;
export type ChannelHealthState = (typeof CHANNEL_HEALTH_STATES)[number];

export interface CommunicationChannelCandidate {
  readonly channel: CommunicationChannel;
  readonly contactPointVerified: boolean;
  readonly permissionAllowed: boolean;
  readonly health: ChannelHealthState;
  readonly compromised: boolean;
}

export interface CommunicationRouteInput {
  readonly purpose: CommunicationPurpose;
  readonly priority: CommunicationPriority;
  readonly candidates: readonly CommunicationChannelCandidate[];
  readonly marketingConsentGranted: boolean;
  readonly quietHoursActive: boolean;
  readonly silentAssistance: boolean;
}

export interface CommunicationRouteDecision {
  readonly state: 'ROUTABLE' | 'DEFERRED_QUIET_HOURS' | 'SUPPRESSED_NO_CONSENT' | 'NO_SAFE_CHANNEL';
  readonly channels: readonly CommunicationChannel[];
  readonly fallbackRequired: boolean;
  readonly marketingSeparatedFromOperational: true;
  readonly unsafeOrCompromisedChannelsExcluded: true;
  readonly providerExecutionAuthorised: false;
}

const criticalPurposes: readonly CommunicationPurpose[] = ['SAFETY', 'SCHOOL_SAFEGUARDING', 'ACCOUNT_SECURITY'];
const contactlessAuthenticatedChannels: readonly CommunicationChannel[] = ['IN_APP', 'PUSH', 'PROTECTED_CHAT', 'AUTHENTICATED_PORTAL'];

export function planCommunicationRoute(input: CommunicationRouteInput): CommunicationRouteDecision {
  if (input.purpose === 'MARKETING' && !input.marketingConsentGranted) {
    return fixedRouteDecision('SUPPRESSED_NO_CONSENT', []);
  }
  const critical = input.priority === 'P0' || input.priority === 'P1' || criticalPurposes.includes(input.purpose);
  if (input.quietHoursActive && !critical) {
    return fixedRouteDecision('DEFERRED_QUIET_HOURS', []);
  }

  const channels = input.candidates
    .filter((candidate) => candidate.permissionAllowed)
    .filter((candidate) => !candidate.compromised)
    .filter((candidate) => candidate.health !== 'UNAVAILABLE')
    .filter((candidate) => contactlessAuthenticatedChannels.includes(candidate.channel) || candidate.contactPointVerified)
    .filter((candidate) => !input.silentAssistance || !['VOICE_CALL', 'MASKED_CALL'].includes(candidate.channel))
    .map((candidate) => candidate.channel)
    .filter((channel, index, all) => all.indexOf(channel) === index);

  if (!channels.length) return fixedRouteDecision('NO_SAFE_CHANNEL', []);
  return {
    ...fixedRouteDecision('ROUTABLE', channels),
    fallbackRequired: critical
  };
}

function fixedRouteDecision(
  state: CommunicationRouteDecision['state'],
  channels: readonly CommunicationChannel[]
): CommunicationRouteDecision {
  return {
    state,
    channels,
    fallbackRequired: false,
    marketingSeparatedFromOperational: true,
    unsafeOrCompromisedChannelsExcluded: true,
    providerExecutionAuthorised: false
  };
}

export interface CommunicationCurrencyInput {
  readonly communicationStatus: 'QUEUED' | 'DELIVERY_PENDING' | 'DELIVERED' | 'ACK_REQUIRED' | 'ACKNOWLEDGED' | 'FAILED' | 'EXPIRED' | 'SUPPRESSED';
  readonly sourceAggregateVersion: number;
  readonly currentAggregateVersion: number;
  readonly expiresAt: Date | null;
  readonly now: Date;
}

export function assessCommunicationCurrency(input: CommunicationCurrencyInput): {
  readonly current: boolean;
  readonly deliveryAllowed: boolean;
  readonly suppressionReason?: 'SOURCE_VERSION_STALE' | 'EXPIRED' | 'TERMINAL_STATE';
} {
  if (['ACKNOWLEDGED', 'FAILED', 'EXPIRED', 'SUPPRESSED'].includes(input.communicationStatus)) {
    return { current: false, deliveryAllowed: false, suppressionReason: 'TERMINAL_STATE' };
  }
  if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
    return { current: false, deliveryAllowed: false, suppressionReason: 'EXPIRED' };
  }
  if (input.sourceAggregateVersion !== input.currentAggregateVersion) {
    return { current: false, deliveryAllowed: false, suppressionReason: 'SOURCE_VERSION_STALE' };
  }
  return { current: true, deliveryAllowed: true };
}

export function acknowledgementAction(input: {
  readonly acknowledgementRequired: boolean;
  readonly deliveryState: MessageDeliveryState;
  readonly acknowledgementDeadline: Date | null;
  readonly acknowledgedAt: Date | null;
  readonly now: Date;
}): 'NOT_REQUIRED' | 'WAITING' | 'ACKNOWLEDGED' | 'HUMAN_ESCALATION_REQUIRED' {
  if (!input.acknowledgementRequired) return 'NOT_REQUIRED';
  if (input.acknowledgedAt) return 'ACKNOWLEDGED';
  const undeliverable = ['FAILED', 'EXPIRED', 'UNKNOWN', 'SUPPRESSED_STALE'].includes(input.deliveryState);
  const deadlinePassed = input.acknowledgementDeadline !== null
    && input.acknowledgementDeadline.getTime() <= input.now.getTime();
  return undeliverable || deadlinePassed ? 'HUMAN_ESCALATION_REQUIRED' : 'WAITING';
}

export function protectedContactWindowIsActive(input: {
  readonly opensAt: Date;
  readonly expiresAt: Date;
  readonly now: Date;
  readonly linkedCaseOrJourneyActive: boolean;
  readonly personalContactDetailsExposed: boolean;
}): boolean {
  return input.linkedCaseOrJourneyActive
    && input.now.getTime() >= input.opensAt.getTime()
    && input.now.getTime() < input.expiresAt.getTime()
    && !input.personalContactDetailsExposed;
}

export function securityTemplateIsSafe(input: {
  readonly purpose: CommunicationPurpose;
  readonly asksForPassword: boolean;
  readonly asksForFullPin: boolean;
  readonly asksForOtp: boolean;
  readonly asksForDeviceLinkingCode: boolean;
}): boolean {
  if (input.purpose !== 'ACCOUNT_SECURITY') return true;
  return !input.asksForPassword && !input.asksForFullPin && !input.asksForOtp && !input.asksForDeviceLinkingCode;
}

export const MARKETING_MAY_BE_RELABELED_OPERATIONAL = false as const;
export const CALLER_ID_PROVES_IDENTITY = false as const;
export const PERSONAL_CONTACT_DETAILS_EXPOSED_BY_PROTECTED_CONTACT = false as const;
export const EXTERNAL_COMMUNICATION_PROVIDER_CONFIGURED = false as const;
