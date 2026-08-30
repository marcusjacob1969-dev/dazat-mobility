import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.endsWith('.ts')) {
      const sourceUrl = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(sourceUrl))) return { url: sourceUrl.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});

const {
  CLIENT_ENFORCED_TENANT_SCOPE_ACCEPTABLE,
  COST_CENTRE_IS_FINANCE_LEDGER,
  ORGANISATION_ACCEPTANCE_SCENARIOS,
  ORGANISATION_CONCEPTUAL_API_PATHS,
  ORGANISATION_CORE_EVENTS,
  ORGANISATION_EXPORT_INCLUDES_UNRELATED_SENSITIVE_DATA,
  ORGANISATION_EXTERNAL_INTEGRATION_EXECUTION_ENABLED,
  ORGANISATION_OWNS_PASSENGER_IDENTITY,
  ORGANISATION_P0_REQUIREMENTS,
  ORGANISATION_POLICY_MAY_DISABLE_SAFETY_OR_ACCESSIBILITY,
  ORGANISATION_PORTAL_DIRECT_DATABASE_EDITING,
  ORGANISATION_RESTRICTION_MAY_TERMINATE_ACTIVE_JOURNEY,
  ORGANISATION_SSO_GRANTS_DAZAT_PERMISSION,
  ORGANISATION_STAFF_MUTATIONS_ENABLED,
  UNIVERSAL_ORGANISATION_ADMIN_ALLOWED,
  WEBHOOK_FAILURE_MUTATES_CANONICAL_BOOKING,
  evaluateOrganisationApproval,
  evaluateOrganisationBookingAuthority,
  evaluateOrganisationCapability,
  evaluateOrganisationIntegrationRequest,
  evaluateOrganisationInvitationAcceptance,
  evaluateOrganisationLifecycleTransition,
  evaluateOrganisationOffboarding,
  evaluateOrganisationRestriction,
  evaluateOrganisationServicePolicy,
  evaluateOrganisationTenantAccess,
  organisationAcceptanceScenarioMayPass,
  organisationExportMayRun
} = await import('../../packages/domain/src/organisation-operations.ts');

function tenant(overrides = {}) {
  return {
    requestedOrganisationId: 'org-a', objectOrganisationId: 'org-a', membershipOrganisationId: 'org-a',
    membershipState: 'ACTIVE', membershipCurrentlyValid: true, requestedSiteId: 'site-1',
    permittedSiteIds: ['site-1'], requestedCostCentreId: 'cost-1', permittedCostCentreIds: ['cost-1'],
    explicitPlatformRole: false, governedCrossOrganisationRelationship: false,
    crossOrganisationAccessAudited: false, ...overrides
  };
}

function capability(overrides = {}) {
  return {
    membershipState: 'ACTIVE', permission: 'BOOKING.CREATE', grantedPermissions: ['BOOKING.CREATE'],
    universalAdminFlagUsed: false, scopeMatches: true, schoolOrSafeguardingData: false,
    safeguardingPermissionPresent: false, highRiskAdministration: false, stepUpSatisfied: false,
    fourEyesSatisfied: false, shieldDecision: 'ALLOW', ...overrides
  };
}

function bookingAuthority(overrides = {}) {
  return {
    organisationActive: true, membershipActive: true, bookingCreatePermission: true,
    bookingAuthorityRuleActive: true, passengerWithinAuthorisedPopulation: true,
    serviceTypePermitted: true, siteAndCostCentreScopeMatches: true, agreementCurrent: true,
    fundingInstructionRequired: false, fundingInstructionPresentAndFormatValid: false,
    bookerPassengerAndPayerDistinctlyRecorded: true, ...overrides
  };
}

function integration(overrides = {}) {
  return {
    tenantScopeMatches: true, environmentScopeMatches: true, leastPrivilegePermissionPresent: true,
    credentialCurrentAndNotRevoked: true, idempotencyKeyPresent: true, signedWebhook: true,
    signatureValid: true, replayedEvent: false, eventIdPresent: true,
    sensitivePayloadMinimised: true, ...overrides
  };
}

function acceptance(overrides = {}) {
  return {
    scenario: 'SITE_ISOLATION', usedCanonicalBookingJourneyEngines: true,
    tenantIsolationEnforcedServerSide: true, roleAndPurposeScopePreserved: true,
    passengerIdentityPreserved: true, accessibilityAndSafetyPreserved: true,
    financeLedgerUntouched: true, idempotencyAndAuditEvidencePresent: true,
    contactedExternalIntegration: false, ...overrides
  };
}

test('organisation lifecycle is staged and never one approved boolean', () => {
  const result = evaluateOrganisationLifecycleTransition({
    from: 'CONFIGURATION', to: 'ACTIVE', actorRecorded: true, decisionReasonRecorded: true,
    effectiveTimeRecorded: true, approvalEvidenceRecorded: true
  });
  assert.equal(result.allowed, true);
  assert.equal(result.singleApprovedBooleanUsed, false);
});

test('organisation lifecycle rejects shortcuts and unaudited material decisions', () => {
  const result = evaluateOrganisationLifecycleTransition({
    from: 'PROSPECT', to: 'ACTIVE', actorRecorded: false, decisionReasonRecorded: false,
    effectiveTimeRecorded: false, approvalEvidenceRecorded: false
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('INVALID_ORGANISATION_LIFECYCLE_TRANSITION'));
  assert.ok(result.blockers.includes('MATERIAL_DECISION_EVIDENCE_REQUIRED'));
});

test('tenant scope is enforced by the backend, not an object ID or URL', () => {
  const result = evaluateOrganisationTenantAccess(tenant({ objectOrganisationId: 'org-b' }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('OBJECT_TENANT_MISMATCH'));
  assert.equal(result.tenantScopeEnforcedByBackend, true);
  assert.equal(result.clientIdentifierGrantsAccess, false);
});

test('site and cost-centre scopes stay narrower than membership', () => {
  const result = evaluateOrganisationTenantAccess(tenant({
    requestedSiteId: 'site-2', requestedCostCentreId: 'cost-2'
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('SITE_SCOPE_DENIED'));
  assert.ok(result.blockers.includes('COST_CENTRE_SCOPE_DENIED'));
});

test('cross-organisation access requires platform role, relationship and audit together', () => {
  const denied = evaluateOrganisationTenantAccess(tenant({
    membershipOrganisationId: 'org-b', explicitPlatformRole: true,
    governedCrossOrganisationRelationship: true, crossOrganisationAccessAudited: false
  }));
  assert.equal(denied.allowed, false);
  const allowed = evaluateOrganisationTenantAccess(tenant({
    membershipOrganisationId: 'org-b', explicitPlatformRole: true,
    governedCrossOrganisationRelationship: true, crossOrganisationAccessAudited: true
  }));
  assert.equal(allowed.allowed, true);
});

test('there is no universal organisation admin capability', () => {
  const result = evaluateOrganisationCapability(capability({ universalAdminFlagUsed: true }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('UNIVERSAL_ADMIN_PROHIBITED'));
  assert.equal(result.universalAdminAuthority, false);
});

test('finance-only membership cannot inherit safeguarding visibility', () => {
  const result = evaluateOrganisationCapability(capability({
    permission: 'SCHOOL.HANDOVER_VIEW', grantedPermissions: ['FINANCE.INVOICE_VIEW'],
    schoolOrSafeguardingData: true, safeguardingPermissionPresent: false
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('CAPABILITY_NOT_GRANTED'));
  assert.ok(result.blockers.includes('INDEPENDENT_SAFEGUARDING_PERMISSION_REQUIRED'));
});

test('high-risk administration needs step-up and four-eyes evidence', () => {
  const result = evaluateOrganisationCapability(capability({
    permission: 'USER.ROLE_MANAGE', grantedPermissions: ['USER.ROLE_MANAGE'],
    highRiskAdministration: true
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('STEP_UP_REQUIRED'));
  assert.ok(result.blockers.includes('FOUR_EYES_REVIEW_REQUIRED'));
});

test('satisfied Shield step-up may proceed while HOLD and BLOCK fail closed', () => {
  assert.equal(evaluateOrganisationCapability(capability({
    stepUpSatisfied: true, shieldDecision: 'STEP_UP'
  })).allowed, true);
  assert.equal(evaluateOrganisationCapability(capability({ shieldDecision: 'HOLD' })).allowed, false);
  assert.equal(evaluateOrganisationCapability(capability({ shieldDecision: 'BLOCK' })).allowed, false);
});

test('forwarding an invitation never transfers membership authority', () => {
  const result = evaluateOrganisationInvitationAcceptance({
    purposeBound: true, invitationExpired: false, intendedOrganisationMatches: true,
    intendedRecipientMatches: false, recipientAuthenticated: true, roleSetApproved: true
  });
  assert.equal(result.allowed, false);
  assert.equal(result.forwardedEmailTransfersMembership, false);
});

test('membership alone cannot book for an unrelated passenger', () => {
  const result = evaluateOrganisationBookingAuthority(bookingAuthority({
    passengerWithinAuthorisedPopulation: false
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('PASSENGER_OUTSIDE_AUTHORISED_POPULATION'));
  assert.equal(result.organisationOwnsPassengerIdentity, false);
});

test('organisation booking uses the canonical engine and distinct parties', () => {
  const result = evaluateOrganisationBookingAuthority(bookingAuthority());
  assert.equal(result.allowed, true);
  assert.equal(result.usesCanonicalBookingEngine, true);
  assert.equal(result.organisationOwnsPassengerIdentity, false);
});

test('required purchase order or authorisation format fails closed when absent', () => {
  const result = evaluateOrganisationBookingAuthority(bookingAuthority({
    fundingInstructionRequired: true, fundingInstructionPresentAndFormatValid: false
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('FUNDING_INSTRUCTION_REQUIRED'));
});

test('organisation policy cannot downgrade accessibility, Safety or safeguarding', () => {
  const result = evaluateOrganisationServicePolicy({
    serviceTypeAllowed: true, bookingWindowAllowed: true, costCentreAllowed: true,
    passengerAccessibilityRequirementsPreserved: false, universalSafetyFunctionsPreserved: true,
    schoolSafeguardingRulesPreserved: true, activeJourneySafetyDrivenChange: false,
    ordinaryOrganisationApprovalAvailable: true
  });
  assert.equal(result.action, 'REJECT_POLICY');
  assert.equal(result.organisationPolicyMayDowngradeSafetyOrAccessibility, false);
});

test('active-journey safety change continues when corporate approval is unavailable', () => {
  const result = evaluateOrganisationServicePolicy({
    serviceTypeAllowed: false, bookingWindowAllowed: false, costCentreAllowed: false,
    passengerAccessibilityRequirementsPreserved: true, universalSafetyFunctionsPreserved: true,
    schoolSafeguardingRulesPreserved: true, activeJourneySafetyDrivenChange: true,
    ordinaryOrganisationApprovalAvailable: false
  });
  assert.equal(result.action, 'CONTINUE_SAFE_HANDLING_RECONCILE_AFTER');
});

test('material booking or quote changes require reapproval', () => {
  const result = evaluateOrganisationApproval({
    state: 'APPROVED', proposedBookingVersion: 3, approvedBookingVersion: 2,
    proposedQuoteVersion: 4, approvedQuoteVersion: 4, materialChangeAfterApproval: true,
    approverAuthorised: true, approvalEvidenceRecorded: true
  });
  assert.equal(result.usable, false);
  assert.equal(result.reapprovalRequired, true);
  assert.equal(result.approvalEditsFinanceLedger, false);
});

test('matching versioned approval is usable without editing Finance', () => {
  const result = evaluateOrganisationApproval({
    state: 'APPROVED', proposedBookingVersion: 3, approvedBookingVersion: 3,
    proposedQuoteVersion: 4, approvedQuoteVersion: 4, materialChangeAfterApproval: false,
    approverAuthorised: true, approvalEvidenceRecorded: true
  });
  assert.equal(result.usable, true);
  assert.equal(result.approvalEditsFinanceLedger, false);
});

test('arrears restriction blocks scoped new credit without terminating active journey', () => {
  const result = evaluateOrganisationRestriction({
    scopes: ['CREDIT_BOOKINGS'], requestedActionScope: 'CREDIT_BOOKINGS',
    reasonRecorded: true, actorAndEffectiveTimeRecorded: true,
    activeJourney: true, actionWouldTerminateActiveJourney: false
  });
  assert.equal(result.actionAllowed, false);
  assert.equal(result.activeJourneyContinues, true);
  assert.equal(result.restrictionCreatesPassengerOrDriverFinding, false);
});

test('restriction request that would terminate an active journey fails closed', () => {
  const result = evaluateOrganisationRestriction({
    scopes: ['NEW_BOOKINGS'], requestedActionScope: 'API_ACCESS',
    reasonRecorded: true, actorAndEffectiveTimeRecorded: true,
    activeJourney: true, actionWouldTerminateActiveJourney: true
  });
  assert.equal(result.actionAllowed, false);
  assert.equal(result.activeJourneyContinues, true);
});

test('ordinary report export excludes raw Safety, location, card, clinical and unrelated journey data', () => {
  assert.equal(organisationExportMayRun({
    reportingExportPermission: true, purposeDefined: true, organisationScopeMatches: true,
    timeBounded: true, sensitiveExport: false, stepUpOrApprovalSatisfied: false,
    includesRawSafetyEvidence: false, includesRawLocationTrace: false,
    includesCardInformation: false, includesClinicalDetails: false,
    includesUnrelatedPassengerJourneys: false
  }), true);
  assert.equal(organisationExportMayRun({
    reportingExportPermission: true, purposeDefined: true, organisationScopeMatches: true,
    timeBounded: true, sensitiveExport: false, stepUpOrApprovalSatisfied: false,
    includesRawSafetyEvidence: true, includesRawLocationTrace: false,
    includesCardInformation: false, includesClinicalDetails: false,
    includesUnrelatedPassengerJourneys: false
  }), false);
});

test('sensitive export requires step-up or approval', () => {
  assert.equal(organisationExportMayRun({
    reportingExportPermission: true, purposeDefined: true, organisationScopeMatches: true,
    timeBounded: true, sensitiveExport: true, stepUpOrApprovalSatisfied: false,
    includesRawSafetyEvidence: false, includesRawLocationTrace: false,
    includesCardInformation: false, includesClinicalDetails: false,
    includesUnrelatedPassengerJourneys: false
  }), false);
});

test('API clients require tenant, environment, credential, least privilege and idempotency', () => {
  const result = evaluateOrganisationIntegrationRequest(integration({
    tenantScopeMatches: false, environmentScopeMatches: false,
    leastPrivilegePermissionPresent: false, idempotencyKeyPresent: false
  }));
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('API_TENANT_SCOPE_MISMATCH'));
  assert.ok(result.blockers.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.equal(result.humanPermissionInferredFromBookingId, false);
});

test('signed webhook replay is deduplicated and cannot mutate Booking by failure', () => {
  const result = evaluateOrganisationIntegrationRequest(integration({ replayedEvent: true }));
  assert.equal(result.allowed, false);
  assert.equal(result.deduplicated, true);
  assert.ok(result.blockers.includes('REPLAY_DEDUPLICATED'));
  assert.equal(result.webhookFailureChangesCanonicalBookingState, false);
});

test('offboarding revokes organisation authority without deleting passenger identity', () => {
  const result = evaluateOrganisationOffboarding({
    newBookingStopRecorded: true, futureBookingDispositionRecorded: true,
    activeBookingDispositionPreservesSafetyAndContinuity: true,
    finalFinanceReconciliationReferenced: true, apiCredentialsRevoked: true,
    membershipsRevoked: true, retentionAndExportRulesRecorded: true,
    passengerIdentityDeleted: false, lawfulPassengerHistoryDeleted: false
  });
  assert.equal(result.allowed, true);
  assert.equal(result.organisationAuthorityRevoked, true);
});

test('offboarding cannot delete lawful passenger or Safety history', () => {
  const result = evaluateOrganisationOffboarding({
    newBookingStopRecorded: true, futureBookingDispositionRecorded: true,
    activeBookingDispositionPreservesSafetyAndContinuity: true,
    finalFinanceReconciliationReferenced: true, apiCredentialsRevoked: true,
    membershipsRevoked: true, retentionAndExportRulesRecorded: true,
    passengerIdentityDeleted: true, lawfulPassengerHistoryDeleted: true
  });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('PASSENGER_IDENTITY_HISTORY_DELETION_PROHIBITED'));
});

test('Part 1 catalogues are complete and versioned', () => {
  assert.equal(ORGANISATION_CONCEPTUAL_API_PATHS.length, 12);
  assert.equal(ORGANISATION_CORE_EVENTS.length, 20);
  assert.ok(ORGANISATION_CORE_EVENTS.every((event) => /\.v1$/.test(event)));
  assert.equal(ORGANISATION_P0_REQUIREMENTS.length, 12);
  assert.equal(ORGANISATION_ACCEPTANCE_SCENARIOS.length, 14);
});

test('acceptance scenarios require canonical, tenant, role, passenger, Safety, Finance and audit truth', () => {
  assert.equal(organisationAcceptanceScenarioMayPass(acceptance()), true);
  assert.equal(organisationAcceptanceScenarioMayPass(acceptance({ tenantIsolationEnforcedServerSide: false })), false);
  assert.equal(organisationAcceptanceScenarioMayPass(acceptance({ financeLedgerUntouched: false })), false);
  assert.equal(organisationAcceptanceScenarioMayPass(acceptance({ contactedExternalIntegration: true })), false);
});

test('organisation operations hard boundaries remain false', () => {
  assert.equal(UNIVERSAL_ORGANISATION_ADMIN_ALLOWED, false);
  assert.equal(CLIENT_ENFORCED_TENANT_SCOPE_ACCEPTABLE, false);
  assert.equal(ORGANISATION_OWNS_PASSENGER_IDENTITY, false);
  assert.equal(ORGANISATION_POLICY_MAY_DISABLE_SAFETY_OR_ACCESSIBILITY, false);
  assert.equal(COST_CENTRE_IS_FINANCE_LEDGER, false);
  assert.equal(ORGANISATION_RESTRICTION_MAY_TERMINATE_ACTIVE_JOURNEY, false);
  assert.equal(ORGANISATION_EXPORT_INCLUDES_UNRELATED_SENSITIVE_DATA, false);
  assert.equal(WEBHOOK_FAILURE_MUTATES_CANONICAL_BOOKING, false);
  assert.equal(ORGANISATION_SSO_GRANTS_DAZAT_PERMISSION, false);
  assert.equal(ORGANISATION_PORTAL_DIRECT_DATABASE_EDITING, false);
  assert.equal(ORGANISATION_EXTERNAL_INTEGRATION_EXECUTION_ENABLED, false);
  assert.equal(ORGANISATION_STAFF_MUTATIONS_ENABLED, false);
});
