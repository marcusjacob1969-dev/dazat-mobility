import type {
  OrganisationAcceptanceScenario,
  OrganisationLifecycleState,
  OrganisationMembershipState,
  OrganisationPermission,
  OrganisationRoleFamily,
  OrganisationType
} from '@dazat/domain';

export interface OrganisationOperationsCapabilitiesProjection {
  readonly organisationTypes: readonly OrganisationType[];
  readonly lifecycleStates: readonly OrganisationLifecycleState[];
  readonly membershipStates: readonly OrganisationMembershipState[];
  readonly roleFamilies: readonly OrganisationRoleFamily[];
  readonly permissions: readonly OrganisationPermission[];
  readonly conceptualApiPaths: readonly string[];
  readonly coreEvents: readonly string[];
  readonly p0Requirements: readonly string[];
  readonly acceptanceScenarios: readonly OrganisationAcceptanceScenario[];
  readonly backendTenantIsolationEnforced: true;
  readonly granularPermissionModelled: true;
  readonly bookingAuthoritySeparatedFromMembership: true;
  readonly bookerPassengerAndPayerSeparated: true;
  readonly accessibilityAndSafetyOverrideOrganisationPolicy: true;
  readonly organisationOwnsPassengerIdentity: false;
  readonly universalOrganisationAdminAllowed: false;
  readonly costCentreIsFinanceLedger: false;
  readonly portalDirectDatabaseEditingAllowed: false;
  readonly organisationStaffMutationsEnabled: false;
  readonly externalIntegrationExecutionEnabled: false;
}

export interface ActorOrganisationSummaryProjection {
  readonly organisationId: string;
  readonly displayName: string;
  readonly organisationType: OrganisationType;
  readonly organisationState: OrganisationLifecycleState;
  readonly membershipId: string;
  readonly membershipState: 'ACTIVE';
  readonly membershipValidUntil: string | null;
  readonly roleFamilies: readonly OrganisationRoleFamily[];
  readonly tenantScopedByAuthenticatedPerson: true;
}

export interface ActorOrganisationContextProjection extends ActorOrganisationSummaryProjection {
  readonly permissions: readonly OrganisationPermission[];
  readonly permittedSiteIds: readonly string[];
  readonly permittedCostCentreKeys: readonly string[];
  readonly permittedServiceTypes: readonly string[];
  readonly permittedPassengerGroupReferences: readonly string[];
  readonly activeSiteCount: number;
  readonly activeCostCentreCount: number;
  readonly activeAgreementCount: number;
  readonly activeRestrictionCount: number;
  readonly openApprovalCount: number;
  readonly openSupportCaseCount: number;
  readonly backendTenantIsolationEnforced: true;
  readonly clientSuppliedOrganisationIdGrantsAccess: false;
  readonly portalMutationEnabled: false;
  readonly integrationExecutionEnabled: false;
}
