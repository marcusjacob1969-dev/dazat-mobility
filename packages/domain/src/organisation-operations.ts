export const ORGANISATION_TYPES = [
  'BUSINESS', 'SCHOOL_EDUCATION', 'LOCAL_AUTHORITY_PUBLIC_BODY', 'HOSPITAL_HEALTHCARE',
  'CARE_ORGANISATION', 'CHARITY_COMMUNITY', 'PARTNER_OPERATOR'
] as const;
export type OrganisationType = (typeof ORGANISATION_TYPES)[number];

export const ORGANISATION_LIFECYCLE_STATES = [
  'PROSPECT', 'APPLICATION_DUE_DILIGENCE', 'COMMERCIAL_SERVICE_REVIEW', 'CONTRACT_PENDING',
  'CONFIGURATION', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'OFFBOARDING', 'CLOSED'
] as const;
export type OrganisationLifecycleState = (typeof ORGANISATION_LIFECYCLE_STATES)[number];

export const ORGANISATION_MEMBERSHIP_STATES = [
  'INVITED', 'ACTIVE', 'TEMPORARILY_RESTRICTED', 'SUSPENDED', 'EXPIRED',
  'REVOKED', 'LEFT_ORGANISATION'
] as const;
export type OrganisationMembershipState = (typeof ORGANISATION_MEMBERSHIP_STATES)[number];

export const ORGANISATION_ROLE_FAMILIES = [
  'ORGANISATION_OWNER_PRIMARY_ADMIN', 'TRANSPORT_COORDINATOR', 'BOOKER', 'FINANCE',
  'SCHOOL_TRANSPORT_COORDINATOR', 'SAFEGUARDING_LEAD', 'SERVICE_MANAGER',
  'READ_ONLY_AUDITOR', 'API_SERVICE_ACCOUNT'
] as const;
export type OrganisationRoleFamily = (typeof ORGANISATION_ROLE_FAMILIES)[number];

export const ORGANISATION_PERMISSIONS = [
  'BOOKING.CREATE', 'BOOKING.CANCEL', 'BOOKING.CHANGE', 'PASSENGER.ROSTER_VIEW',
  'PASSENGER.ROSTER_EDIT', 'SCHOOL.HANDOVER_VIEW', 'SCHOOL.HANDOVER_MANAGE',
  'FINANCE.INVOICE_VIEW', 'FINANCE.COST_CENTRE_MANAGE', 'REPORTING.EXPORT',
  'USER.INVITE', 'USER.ROLE_MANAGE', 'ORG.SETTINGS_MANAGE'
] as const;
export type OrganisationPermission = (typeof ORGANISATION_PERMISSIONS)[number];

export const ORGANISATION_RESTRICTION_SCOPES = [
  'NEW_BOOKINGS', 'SPECIFIC_SERVICE', 'SPECIFIC_SITE', 'CREDIT_BOOKINGS',
  'API_ACCESS', 'EXPORTS', 'ADMIN_CHANGES'
] as const;
export type OrganisationRestrictionScope = (typeof ORGANISATION_RESTRICTION_SCOPES)[number];

export const ORGANISATION_APPROVAL_STATES = [
  'NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'
] as const;
export type OrganisationApprovalState = (typeof ORGANISATION_APPROVAL_STATES)[number];

export const ORGANISATION_CONTACT_PURPOSES = [
  'OPERATIONS', 'FINANCE', 'CONTRACT', 'SAFEGUARDING', 'EMERGENCY_ESCALATION',
  'DATA_PROTECTION', 'TECHNICAL_API'
] as const;

export const ORGANISATION_CONCEPTUAL_API_PATHS = [
  '/organisations', '/organisations/{id}/sites', '/organisations/{id}/users',
  '/organisations/{id}/roles', '/organisations/{id}/contacts', '/organisations/{id}/policies',
  '/organisations/{id}/passengers', '/organisations/{id}/approvals',
  '/organisations/{id}/cost-centres', '/organisations/{id}/agreements',
  '/organisations/{id}/reports', '/organisations/{id}/api-clients'
] as const;

export const ORGANISATION_CORE_EVENTS = [
  'OrganisationCreated.v1', 'OrganisationActivated.v1', 'OrganisationRestricted.v1',
  'OrganisationRestrictionLifted.v1', 'OrganisationUserInvited.v1',
  'OrganisationMembershipActivated.v1', 'OrganisationMembershipRevoked.v1',
  'OrganisationRoleChanged.v1', 'OrganisationContactChanged.v1',
  'OrganisationAgreementActivated.v1', 'OrganisationAgreementExpired.v1',
  'OrganisationPolicyChanged.v1', 'PassengerAddedToRoster.v1',
  'PassengerRemovedFromRoster.v1', 'OrganisationApprovalRequested.v1',
  'OrganisationApprovalGranted.v1', 'OrganisationApprovalRejected.v1',
  'OrganisationApiCredentialRotated.v1', 'OrganisationOffboardingStarted.v1',
  'OrganisationClosed.v1'
] as const;

export const ORGANISATION_P0_REQUIREMENTS = [
  'ORG-ID-001', 'ORG-TEN-001', 'ORG-RBAC-001', 'ORG-PARTY-001',
  'ORG-AUTH-001', 'ORG-ACC-001', 'ORG-SCH-001', 'ORG-FIN-001',
  'ORG-ACT-001', 'ORG-API-001', 'ORG-EXP-001', 'ORG-AUD-001'
] as const;

export const ORGANISATION_ACCEPTANCE_SCENARIOS = [
  'SITE_ISOLATION', 'FINANCE_ONLY_ROLE', 'DISTINCT_BOOKER_PASSENGER_PAYER',
  'UNRELATED_PASSENGER_BOOKING_DENIED', 'SCHOOL_ADMIN_SAFEGUARDING_DENIED',
  'ACCESSIBILITY_OVERRIDES_COST_POLICY', 'MATERIAL_QUOTE_CHANGE_REAPPROVAL',
  'SAFETY_CHANGE_WITHOUT_CORPORATE_APPROVAL', 'ARREARS_ACTIVE_JOURNEY_CONTINUES',
  'NEW_DEVICE_PRIMARY_ADMIN_STEP_UP', 'CROSS_TENANT_OBJECT_ACCESS_DENIED',
  'SIGNED_REQUEST_REPLAY_DEDUPLICATED', 'SENSITIVE_EXPORT_MINIMISED',
  'OFFBOARDING_PRESERVES_PASSENGER_AND_SAFETY'
] as const;
export type OrganisationAcceptanceScenario = (typeof ORGANISATION_ACCEPTANCE_SCENARIOS)[number];

const lifecycleTransitions: Readonly<Record<OrganisationLifecycleState, readonly OrganisationLifecycleState[]>> = {
  PROSPECT: ['APPLICATION_DUE_DILIGENCE'],
  APPLICATION_DUE_DILIGENCE: ['COMMERCIAL_SERVICE_REVIEW', 'CLOSED'],
  COMMERCIAL_SERVICE_REVIEW: ['CONTRACT_PENDING', 'CLOSED'],
  CONTRACT_PENDING: ['CONFIGURATION', 'CLOSED'],
  CONFIGURATION: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['RESTRICTED', 'SUSPENDED', 'OFFBOARDING'],
  RESTRICTED: ['ACTIVE', 'SUSPENDED', 'OFFBOARDING'],
  SUSPENDED: ['ACTIVE', 'OFFBOARDING'],
  OFFBOARDING: ['CLOSED'],
  CLOSED: []
};

export function evaluateOrganisationLifecycleTransition(input: {
  readonly from: OrganisationLifecycleState;
  readonly to: OrganisationLifecycleState;
  readonly actorRecorded: boolean;
  readonly decisionReasonRecorded: boolean;
  readonly effectiveTimeRecorded: boolean;
  readonly approvalEvidenceRecorded: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly singleApprovedBooleanUsed: false } {
  const blockers: string[] = [];
  if (!lifecycleTransitions[input.from].includes(input.to)) blockers.push('INVALID_ORGANISATION_LIFECYCLE_TRANSITION');
  if (!input.actorRecorded) blockers.push('DECISION_ACTOR_REQUIRED');
  if (!input.decisionReasonRecorded) blockers.push('DECISION_REASON_REQUIRED');
  if (!input.effectiveTimeRecorded) blockers.push('EFFECTIVE_TIME_REQUIRED');
  if (['ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED'].includes(input.to) && !input.approvalEvidenceRecorded) {
    blockers.push('MATERIAL_DECISION_EVIDENCE_REQUIRED');
  }
  return { allowed: blockers.length === 0, blockers, singleApprovedBooleanUsed: false };
}

export function evaluateOrganisationTenantAccess(input: {
  readonly requestedOrganisationId: string;
  readonly objectOrganisationId: string;
  readonly membershipOrganisationId: string;
  readonly membershipState: OrganisationMembershipState;
  readonly membershipCurrentlyValid: boolean;
  readonly requestedSiteId?: string;
  readonly permittedSiteIds: readonly string[];
  readonly requestedCostCentreId?: string;
  readonly permittedCostCentreIds: readonly string[];
  readonly explicitPlatformRole: boolean;
  readonly governedCrossOrganisationRelationship: boolean;
  readonly crossOrganisationAccessAudited: boolean;
}): {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly tenantScopeEnforcedByBackend: true;
  readonly clientIdentifierGrantsAccess: false;
} {
  const blockers: string[] = [];
  if (input.requestedOrganisationId !== input.objectOrganisationId) blockers.push('OBJECT_TENANT_MISMATCH');
  const ownTenant = input.membershipOrganisationId === input.requestedOrganisationId;
  if (!ownTenant && !(input.explicitPlatformRole && input.governedCrossOrganisationRelationship
      && input.crossOrganisationAccessAudited)) blockers.push('CROSS_TENANT_ACCESS_DENIED');
  if (ownTenant && (input.membershipState !== 'ACTIVE' || !input.membershipCurrentlyValid)) {
    blockers.push('ACTIVE_VALID_MEMBERSHIP_REQUIRED');
  }
  if (input.requestedSiteId && !input.permittedSiteIds.includes(input.requestedSiteId)) blockers.push('SITE_SCOPE_DENIED');
  if (input.requestedCostCentreId && !input.permittedCostCentreIds.includes(input.requestedCostCentreId)) {
    blockers.push('COST_CENTRE_SCOPE_DENIED');
  }
  return {
    allowed: blockers.length === 0,
    blockers,
    tenantScopeEnforcedByBackend: true,
    clientIdentifierGrantsAccess: false
  };
}

export function evaluateOrganisationCapability(input: {
  readonly membershipState: OrganisationMembershipState;
  readonly permission: OrganisationPermission;
  readonly grantedPermissions: readonly OrganisationPermission[];
  readonly universalAdminFlagUsed: boolean;
  readonly scopeMatches: boolean;
  readonly schoolOrSafeguardingData: boolean;
  readonly safeguardingPermissionPresent: boolean;
  readonly highRiskAdministration: boolean;
  readonly stepUpSatisfied: boolean;
  readonly fourEyesSatisfied: boolean;
  readonly shieldDecision: 'ALLOW' | 'ALLOW_AND_MONITOR' | 'STEP_UP' | 'LIMIT' | 'HOLD' | 'REVIEW' | 'BLOCK';
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly universalAdminAuthority: false } {
  const blockers: string[] = [];
  if (input.membershipState !== 'ACTIVE') blockers.push('ACTIVE_MEMBERSHIP_REQUIRED');
  if (!input.grantedPermissions.includes(input.permission)) blockers.push('CAPABILITY_NOT_GRANTED');
  if (input.universalAdminFlagUsed) blockers.push('UNIVERSAL_ADMIN_PROHIBITED');
  if (!input.scopeMatches) blockers.push('PERMISSION_SCOPE_MISMATCH');
  if (input.schoolOrSafeguardingData && !input.safeguardingPermissionPresent) {
    blockers.push('INDEPENDENT_SAFEGUARDING_PERMISSION_REQUIRED');
  }
  if (input.highRiskAdministration && !input.stepUpSatisfied) blockers.push('STEP_UP_REQUIRED');
  if (input.highRiskAdministration && !input.fourEyesSatisfied) blockers.push('FOUR_EYES_REVIEW_REQUIRED');
  if (input.shieldDecision === 'STEP_UP' && !input.stepUpSatisfied) blockers.push('SHIELD_STEP_UP');
  if (['LIMIT', 'HOLD', 'REVIEW', 'BLOCK'].includes(input.shieldDecision)) {
    blockers.push(`SHIELD_${input.shieldDecision}`);
  }
  return { allowed: blockers.length === 0, blockers, universalAdminAuthority: false };
}

export function evaluateOrganisationInvitationAcceptance(input: {
  readonly purposeBound: boolean;
  readonly invitationExpired: boolean;
  readonly intendedOrganisationMatches: boolean;
  readonly intendedRecipientMatches: boolean;
  readonly recipientAuthenticated: boolean;
  readonly roleSetApproved: boolean;
}): { readonly allowed: boolean; readonly forwardedEmailTransfersMembership: false } {
  return {
    allowed: input.purposeBound && !input.invitationExpired && input.intendedOrganisationMatches
      && input.intendedRecipientMatches && input.recipientAuthenticated && input.roleSetApproved,
    forwardedEmailTransfersMembership: false
  };
}

export function evaluateOrganisationBookingAuthority(input: {
  readonly organisationActive: boolean;
  readonly membershipActive: boolean;
  readonly bookingCreatePermission: boolean;
  readonly bookingAuthorityRuleActive: boolean;
  readonly passengerWithinAuthorisedPopulation: boolean;
  readonly serviceTypePermitted: boolean;
  readonly siteAndCostCentreScopeMatches: boolean;
  readonly agreementCurrent: boolean;
  readonly fundingInstructionRequired: boolean;
  readonly fundingInstructionPresentAndFormatValid: boolean;
  readonly bookerPassengerAndPayerDistinctlyRecorded: boolean;
}): {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly organisationOwnsPassengerIdentity: false;
  readonly usesCanonicalBookingEngine: true;
} {
  const blockers: string[] = [];
  if (!input.organisationActive) blockers.push('ORGANISATION_NOT_ACTIVE');
  if (!input.membershipActive || !input.bookingCreatePermission) blockers.push('BOOKER_AUTHORITY_REQUIRED');
  if (!input.bookingAuthorityRuleActive) blockers.push('ACTIVE_BOOKING_AUTHORITY_RULE_REQUIRED');
  if (!input.passengerWithinAuthorisedPopulation) blockers.push('PASSENGER_OUTSIDE_AUTHORISED_POPULATION');
  if (!input.serviceTypePermitted) blockers.push('SERVICE_TYPE_NOT_PERMITTED');
  if (!input.siteAndCostCentreScopeMatches) blockers.push('SITE_OR_COST_CENTRE_SCOPE_MISMATCH');
  if (!input.agreementCurrent) blockers.push('CURRENT_ORGANISATION_AGREEMENT_REQUIRED');
  if (input.fundingInstructionRequired && !input.fundingInstructionPresentAndFormatValid) {
    blockers.push('FUNDING_INSTRUCTION_REQUIRED');
  }
  if (!input.bookerPassengerAndPayerDistinctlyRecorded) blockers.push('BOOKING_PARTIES_MUST_REMAIN_DISTINCT');
  return {
    allowed: blockers.length === 0,
    blockers,
    organisationOwnsPassengerIdentity: false,
    usesCanonicalBookingEngine: true
  };
}

export function evaluateOrganisationServicePolicy(input: {
  readonly serviceTypeAllowed: boolean;
  readonly bookingWindowAllowed: boolean;
  readonly costCentreAllowed: boolean;
  readonly passengerAccessibilityRequirementsPreserved: boolean;
  readonly universalSafetyFunctionsPreserved: boolean;
  readonly schoolSafeguardingRulesPreserved: boolean;
  readonly activeJourneySafetyDrivenChange: boolean;
  readonly ordinaryOrganisationApprovalAvailable: boolean;
}): {
  readonly action: 'ALLOW' | 'REJECT_POLICY' | 'CONTINUE_SAFE_HANDLING_RECONCILE_AFTER';
  readonly organisationPolicyMayDowngradeSafetyOrAccessibility: false;
} {
  if (!input.passengerAccessibilityRequirementsPreserved || !input.universalSafetyFunctionsPreserved
      || !input.schoolSafeguardingRulesPreserved) {
    return { action: 'REJECT_POLICY', organisationPolicyMayDowngradeSafetyOrAccessibility: false };
  }
  if (input.activeJourneySafetyDrivenChange && !input.ordinaryOrganisationApprovalAvailable) {
    return { action: 'CONTINUE_SAFE_HANDLING_RECONCILE_AFTER', organisationPolicyMayDowngradeSafetyOrAccessibility: false };
  }
  return {
    action: input.serviceTypeAllowed && input.bookingWindowAllowed && input.costCentreAllowed ? 'ALLOW' : 'REJECT_POLICY',
    organisationPolicyMayDowngradeSafetyOrAccessibility: false
  };
}

export function evaluateOrganisationApproval(input: {
  readonly state: OrganisationApprovalState;
  readonly proposedBookingVersion: number;
  readonly approvedBookingVersion?: number;
  readonly proposedQuoteVersion: number;
  readonly approvedQuoteVersion?: number;
  readonly materialChangeAfterApproval: boolean;
  readonly approverAuthorised: boolean;
  readonly approvalEvidenceRecorded: boolean;
}): { readonly usable: boolean; readonly reapprovalRequired: boolean; readonly approvalEditsFinanceLedger: false } {
  for (const version of [input.proposedBookingVersion, input.proposedQuoteVersion]) {
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('Booking and quote versions must be positive safe integers');
  }
  const versionMatches = input.approvedBookingVersion === input.proposedBookingVersion
    && input.approvedQuoteVersion === input.proposedQuoteVersion;
  const reapprovalRequired = input.materialChangeAfterApproval || !versionMatches;
  return {
    usable: input.state === 'APPROVED' && input.approverAuthorised
      && input.approvalEvidenceRecorded && !reapprovalRequired,
    reapprovalRequired,
    approvalEditsFinanceLedger: false
  };
}

export function evaluateOrganisationRestriction(input: {
  readonly scopes: readonly OrganisationRestrictionScope[];
  readonly requestedActionScope: OrganisationRestrictionScope;
  readonly reasonRecorded: boolean;
  readonly actorAndEffectiveTimeRecorded: boolean;
  readonly activeJourney: boolean;
  readonly actionWouldTerminateActiveJourney: boolean;
}): {
  readonly actionAllowed: boolean;
  readonly activeJourneyContinues: boolean;
  readonly restrictionCreatesPassengerOrDriverFinding: false;
} {
  const blocked = input.scopes.includes(input.requestedActionScope);
  const validRestriction = input.reasonRecorded && input.actorAndEffectiveTimeRecorded;
  const activeJourneyContinues = input.activeJourney;
  return {
    actionAllowed: !blocked && validRestriction && !input.actionWouldTerminateActiveJourney,
    activeJourneyContinues,
    restrictionCreatesPassengerOrDriverFinding: false
  };
}

export function organisationExportMayRun(input: {
  readonly reportingExportPermission: boolean;
  readonly purposeDefined: boolean;
  readonly organisationScopeMatches: boolean;
  readonly timeBounded: boolean;
  readonly sensitiveExport: boolean;
  readonly stepUpOrApprovalSatisfied: boolean;
  readonly includesRawSafetyEvidence: boolean;
  readonly includesRawLocationTrace: boolean;
  readonly includesCardInformation: boolean;
  readonly includesClinicalDetails: boolean;
  readonly includesUnrelatedPassengerJourneys: boolean;
}): boolean {
  const prohibitedData = input.includesRawSafetyEvidence || input.includesRawLocationTrace
    || input.includesCardInformation || input.includesClinicalDetails || input.includesUnrelatedPassengerJourneys;
  return input.reportingExportPermission && input.purposeDefined && input.organisationScopeMatches
    && input.timeBounded && !prohibitedData
    && (!input.sensitiveExport || input.stepUpOrApprovalSatisfied);
}

export function evaluateOrganisationIntegrationRequest(input: {
  readonly tenantScopeMatches: boolean;
  readonly environmentScopeMatches: boolean;
  readonly leastPrivilegePermissionPresent: boolean;
  readonly credentialCurrentAndNotRevoked: boolean;
  readonly idempotencyKeyPresent: boolean;
  readonly signedWebhook: boolean;
  readonly signatureValid: boolean;
  readonly replayedEvent: boolean;
  readonly eventIdPresent: boolean;
  readonly sensitivePayloadMinimised: boolean;
}): {
  readonly allowed: boolean;
  readonly deduplicated: boolean;
  readonly blockers: readonly string[];
  readonly webhookFailureChangesCanonicalBookingState: false;
  readonly humanPermissionInferredFromBookingId: false;
} {
  const blockers: string[] = [];
  if (!input.tenantScopeMatches) blockers.push('API_TENANT_SCOPE_MISMATCH');
  if (!input.environmentScopeMatches) blockers.push('API_ENVIRONMENT_SCOPE_MISMATCH');
  if (!input.leastPrivilegePermissionPresent) blockers.push('API_PERMISSION_REQUIRED');
  if (!input.credentialCurrentAndNotRevoked) blockers.push('API_CREDENTIAL_INVALID');
  if (!input.idempotencyKeyPresent) blockers.push('IDEMPOTENCY_KEY_REQUIRED');
  if (input.signedWebhook && !input.signatureValid) blockers.push('WEBHOOK_SIGNATURE_INVALID');
  if (!input.eventIdPresent) blockers.push('EVENT_ID_REQUIRED');
  if (!input.sensitivePayloadMinimised) blockers.push('WEBHOOK_PAYLOAD_NOT_MINIMISED');
  if (input.replayedEvent) blockers.push('REPLAY_DEDUPLICATED');
  return {
    allowed: blockers.length === 0,
    deduplicated: input.replayedEvent,
    blockers,
    webhookFailureChangesCanonicalBookingState: false,
    humanPermissionInferredFromBookingId: false
  };
}

export function evaluateOrganisationOffboarding(input: {
  readonly newBookingStopRecorded: boolean;
  readonly futureBookingDispositionRecorded: boolean;
  readonly activeBookingDispositionPreservesSafetyAndContinuity: boolean;
  readonly finalFinanceReconciliationReferenced: boolean;
  readonly apiCredentialsRevoked: boolean;
  readonly membershipsRevoked: boolean;
  readonly retentionAndExportRulesRecorded: boolean;
  readonly passengerIdentityDeleted: boolean;
  readonly lawfulPassengerHistoryDeleted: boolean;
}): { readonly allowed: boolean; readonly blockers: readonly string[]; readonly organisationAuthorityRevoked: boolean } {
  const blockers: string[] = [];
  if (!input.newBookingStopRecorded) blockers.push('NEW_BOOKING_STOP_REQUIRED');
  if (!input.futureBookingDispositionRecorded) blockers.push('FUTURE_BOOKING_DISPOSITION_REQUIRED');
  if (!input.activeBookingDispositionPreservesSafetyAndContinuity) blockers.push('ACTIVE_CONTINUITY_PRESERVATION_REQUIRED');
  if (!input.finalFinanceReconciliationReferenced) blockers.push('FINANCE_RECONCILIATION_REFERENCE_REQUIRED');
  if (!input.apiCredentialsRevoked) blockers.push('API_CREDENTIAL_REVOCATION_REQUIRED');
  if (!input.membershipsRevoked) blockers.push('MEMBERSHIP_REVOCATION_REQUIRED');
  if (!input.retentionAndExportRulesRecorded) blockers.push('RETENTION_EXPORT_RULES_REQUIRED');
  if (input.passengerIdentityDeleted || input.lawfulPassengerHistoryDeleted) blockers.push('PASSENGER_IDENTITY_HISTORY_DELETION_PROHIBITED');
  return { allowed: blockers.length === 0, blockers, organisationAuthorityRevoked: input.membershipsRevoked };
}

export function organisationAcceptanceScenarioMayPass(input: {
  readonly scenario: OrganisationAcceptanceScenario;
  readonly usedCanonicalBookingJourneyEngines: boolean;
  readonly tenantIsolationEnforcedServerSide: boolean;
  readonly roleAndPurposeScopePreserved: boolean;
  readonly passengerIdentityPreserved: boolean;
  readonly accessibilityAndSafetyPreserved: boolean;
  readonly financeLedgerUntouched: boolean;
  readonly idempotencyAndAuditEvidencePresent: boolean;
  readonly contactedExternalIntegration: boolean;
}): boolean {
  return input.usedCanonicalBookingJourneyEngines
    && input.tenantIsolationEnforcedServerSide
    && input.roleAndPurposeScopePreserved
    && input.passengerIdentityPreserved
    && input.accessibilityAndSafetyPreserved
    && input.financeLedgerUntouched
    && input.idempotencyAndAuditEvidencePresent
    && !input.contactedExternalIntegration;
}

export const UNIVERSAL_ORGANISATION_ADMIN_ALLOWED = false as const;
export const CLIENT_ENFORCED_TENANT_SCOPE_ACCEPTABLE = false as const;
export const ORGANISATION_OWNS_PASSENGER_IDENTITY = false as const;
export const ORGANISATION_POLICY_MAY_DISABLE_SAFETY_OR_ACCESSIBILITY = false as const;
export const COST_CENTRE_IS_FINANCE_LEDGER = false as const;
export const ORGANISATION_RESTRICTION_MAY_TERMINATE_ACTIVE_JOURNEY = false as const;
export const ORGANISATION_EXPORT_INCLUDES_UNRELATED_SENSITIVE_DATA = false as const;
export const WEBHOOK_FAILURE_MUTATES_CANONICAL_BOOKING = false as const;
export const ORGANISATION_SSO_GRANTS_DAZAT_PERMISSION = false as const;
export const ORGANISATION_PORTAL_DIRECT_DATABASE_EDITING = false as const;
export const ORGANISATION_EXTERNAL_INTEGRATION_EXECUTION_ENABLED = false as const;
export const ORGANISATION_STAFF_MUTATIONS_ENABLED = false as const;
