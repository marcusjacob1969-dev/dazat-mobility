import type {
  CallerAction,
  CallerRole,
  CallQueue,
  VoiceDialogueState
} from '@dazat/domain';

export interface TelephonyServiceCapabilitiesProjection {
  readonly telephoneUsesCanonicalEngines: true;
  readonly telephoneProviderConfigured: false;
  readonly voiceAssistantConfigured: false;
  readonly operatorConsoleMutationConfigured: false;
  readonly securePaymentHandoffConfigured: false;
  readonly recordingConfigured: false;
  readonly transcriptionConfigured: false;
  readonly interpreterRoutingConfigured: false;
  readonly voiceBiometricsConfigured: false;
  readonly callerIdAuthenticates: false;
  readonly generalVoiceCapturesFullCardDetails: false;
  readonly statusUnknownBlindRetryAllowed: false;
  readonly humanHandoffQueues: readonly CallQueue[];
}

export interface ContactPlanProjection {
  readonly status: 'CONFIGURED' | 'NOT_CONFIGURED';
  readonly version?: number;
  readonly safeChannels: readonly string[];
  readonly arrivalMethod?: string;
  readonly permittedIntermediaryRoles: readonly string[];
  readonly permittedActions: readonly CallerAction[];
  readonly language?: string;
  readonly accessibilityCommunicationNeeds: readonly string[];
  readonly diagnosisStored: false;
  readonly personalContactDetailsExposed: false;
}

export interface CallerIdentityAssessmentProjection {
  readonly assessmentId: string;
  readonly claimedRole: CallerRole;
  readonly confidence: number;
  readonly outcome: 'VERIFIED_SCOPED' | 'CLARIFICATION_REQUIRED' | 'HUMAN_HANDOFF_REQUIRED' | 'HIGH_RISK_VOICE_PROHIBITED';
  readonly restrictions: readonly string[];
  readonly callerIdTreatedAsIdentityProof: false;
  readonly assessedAt: string;
}

export interface CallSessionSummaryProjection {
  readonly callSessionId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly status: 'STARTED' | 'IDENTITY_ASSESSMENT' | 'VOICE_DIALOGUE' | 'HUMAN_QUEUE' | 'CONNECTED_TO_OPERATOR' | 'ENDED' | 'DROPPED' | 'FAILED';
  readonly purpose: string;
  readonly queue?: CallQueue;
  readonly language?: string;
  readonly callQuality: 'GOOD' | 'DEGRADED' | 'UNSTABLE' | 'LOST' | 'UNKNOWN';
  readonly linkedBookingId?: string;
  readonly linkedCaseId?: string;
  readonly latestCallerAssessment?: CallerIdentityAssessmentProjection;
  readonly warmHandoffContextPresent: boolean;
  readonly pendingInteractionPreserved: boolean;
  readonly personalNumberExposed: false;
  readonly startedAt: string;
  readonly endedAt?: string;
}

export interface TelephonyInteractionListProjection {
  readonly interactions: readonly CallSessionSummaryProjection[];
  readonly telephonyProviderConfigured: false;
  readonly voiceAssistantConfigured: false;
  readonly degradedModeExplicit: true;
}

export interface VoiceDialogueProjection {
  readonly dialogueSessionId: string;
  readonly state: VoiceDialogueState;
  readonly intent?: string;
  readonly recognitionFailureCount: number;
  readonly unresolvedCriticalFields: readonly string[];
  readonly humanHandoffRequired: boolean;
  readonly backendValidationBypassed: false;
  readonly transcriptTreatedAsAuthority: false;
}
