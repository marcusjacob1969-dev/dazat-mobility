import type {
  InstitutionalAttentionPriority,
  InstitutionalLiveAcceptanceScenario,
  InstitutionalLiveOutcome,
  InstitutionReadinessOutcome,
  PassengerReadyState
} from '@dazat/domain';

export interface InstitutionalLiveOperationsCapabilitiesProjection {
  readonly attentionPriorities: readonly InstitutionalAttentionPriority[];
  readonly exceptionCategories: readonly string[];
  readonly exceptionStates: readonly string[];
  readonly readinessOutcomes: readonly InstitutionReadinessOutcome[];
  readonly passengerReadyStates: readonly PassengerReadyState[];
  readonly outcomeClassifications: readonly InstitutionalLiveOutcome[];
  readonly conceptualApiPaths: readonly string[];
  readonly conceptualCommands: readonly string[];
  readonly events: readonly string[];
  readonly p0Requirements: readonly string[];
  readonly acceptanceScenarios: readonly InstitutionalLiveAcceptanceScenario[];
  readonly canonicalBookingDispatchJourneyTruthPreserved: true;
  readonly specialistSafetyFinanceRescueCasesRemainAuthoritative: true;
  readonly resolvedAndVerifiedRemainDistinct: true;
  readonly manualDispatchBypassesEligibility: false;
  readonly serviceHealthAutomaticallyCancelsBooking: false;
  readonly signedContractAloneEnablesLaunch: false;
  readonly exitMayAbandonActivePassenger: false;
  readonly institutionalLiveMutationsEnabled: false;
}

export interface InstitutionalAttentionSummaryProjection {
  readonly attentionId: string;
  readonly priority: InstitutionalAttentionPriority;
  readonly status: 'OPEN' | 'OWNED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  readonly sourceType: string;
  readonly ownerAssigned: boolean;
  readonly nextAction: string | null;
  readonly attentionDeadline: string | null;
}

export interface InstitutionTransportExceptionSummaryProjection {
  readonly exceptionId: string;
  readonly category: string;
  readonly severity: InstitutionalAttentionPriority;
  readonly status: string;
  readonly ownerAssigned: boolean;
  readonly attentionDeadline: string | null;
  readonly resolutionVerified: boolean;
}

export interface InstitutionalLiveOperationsContextProjection {
  readonly organisationId: string;
  readonly openP0P1AttentionCount: number;
  readonly openExceptionCount: number;
  readonly atRiskOrBlockedReadinessCount: number;
  readonly openDataQualityIssueCount: number;
  readonly activeDisruptionCount: number;
  readonly latestServiceHealthStatus: 'HEALTHY' | 'WATCH' | 'AT_RISK' | 'CRITICAL' | 'UNKNOWN' | null;
  readonly launchReadinessStatus: 'NOT_ASSESSED' | 'IN_PROGRESS' | 'FAILED' | 'PASSED' | 'RISK_ACCEPTED' | 'EXPIRED' | null;
  readonly activePilotStatus: 'PLANNED' | 'ACTIVE' | 'GATE_REVIEW' | 'PAUSED' | null;
  readonly exitPlanStatus: 'DRAFT' | 'INVENTORY_IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED' | null;
  readonly attentionItems: readonly InstitutionalAttentionSummaryProjection[];
  readonly transportExceptions: readonly InstitutionTransportExceptionSummaryProjection[];
  readonly tenantScopedByAuthenticatedMembership: true;
  readonly readScopedByCurrentOperatorTask: true;
  readonly passengerManifestSafetyAndFinanceDetailExcluded: true;
  readonly controlRoomMutationRequiresCurrentTaskScope: true;
  readonly canonicalDomainTruthPreserved: true;
  readonly mutationEnabled: false;
  readonly externalExecutionEnabled: false;
}
