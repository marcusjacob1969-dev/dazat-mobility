import {
  ORGANISATION_ACCEPTANCE_SCENARIOS,
  ORGANISATION_CONCEPTUAL_API_PATHS,
  ORGANISATION_CORE_EVENTS,
  ORGANISATION_LIFECYCLE_STATES,
  ORGANISATION_MEMBERSHIP_STATES,
  ORGANISATION_P0_REQUIREMENTS,
  ORGANISATION_PERMISSIONS,
  ORGANISATION_ROLE_FAMILIES,
  ORGANISATION_TYPES
} from '@dazat/domain';
import type {
  ActorOrganisationContextProjection,
  ActorOrganisationSummaryProjection,
  OrganisationOperationsCapabilitiesProjection
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export function getOrganisationOperationsCapabilities(): OrganisationOperationsCapabilitiesProjection {
  return {
    organisationTypes: ORGANISATION_TYPES,
    lifecycleStates: ORGANISATION_LIFECYCLE_STATES,
    membershipStates: ORGANISATION_MEMBERSHIP_STATES,
    roleFamilies: ORGANISATION_ROLE_FAMILIES,
    permissions: ORGANISATION_PERMISSIONS,
    conceptualApiPaths: ORGANISATION_CONCEPTUAL_API_PATHS,
    coreEvents: ORGANISATION_CORE_EVENTS,
    p0Requirements: ORGANISATION_P0_REQUIREMENTS,
    acceptanceScenarios: ORGANISATION_ACCEPTANCE_SCENARIOS,
    backendTenantIsolationEnforced: true,
    granularPermissionModelled: true,
    bookingAuthoritySeparatedFromMembership: true,
    bookerPassengerAndPayerSeparated: true,
    accessibilityAndSafetyOverrideOrganisationPolicy: true,
    organisationOwnsPassengerIdentity: false,
    universalOrganisationAdminAllowed: false,
    costCentreIsFinanceLedger: false,
    portalDirectDatabaseEditingAllowed: false,
    organisationStaffMutationsEnabled: false,
    externalIntegrationExecutionEnabled: false
  };
}

type OrganisationSummaryRow = {
  organisation_id: string;
  display_name: string;
  organisation_type: ActorOrganisationSummaryProjection['organisationType'];
  organisation_state: ActorOrganisationSummaryProjection['organisationState'];
  membership_id: string;
  membership_valid_until: Date | string | null;
  role_families: ActorOrganisationSummaryProjection['roleFamilies'];
};

function summary(row: OrganisationSummaryRow): ActorOrganisationSummaryProjection {
  return {
    organisationId: row.organisation_id,
    displayName: row.display_name,
    organisationType: row.organisation_type,
    organisationState: row.organisation_state,
    membershipId: row.membership_id,
    membershipState: 'ACTIVE',
    membershipValidUntil: row.membership_valid_until === null
      ? null
      : new Date(row.membership_valid_until).toISOString(),
    roleFamilies: row.role_families,
    tenantScopedByAuthenticatedPerson: true
  };
}

export async function listActorOrganisations(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<readonly ActorOrganisationSummaryProjection[]> {
  const result = await pool.query<OrganisationSummaryRow>(
    `SELECT organisation.id AS organisation_id,
            organisation.display_name,
            organisation.organisation_type,
            organisation.state AS organisation_state,
            membership.id AS membership_id,
            membership.valid_until AS membership_valid_until,
            COALESCE(array_agg(DISTINCT role.role_family) FILTER (WHERE role.role_family IS NOT NULL), ARRAY[]::text[]) AS role_families
       FROM organisation.organisation_user_membership membership
       JOIN organisation.organisation organisation ON organisation.id = membership.organisation_id
       LEFT JOIN organisation.organisation_permission_grant_version permission_grant
         ON permission_grant.membership_id = membership.id
        AND permission_grant.organisation_id = membership.organisation_id
        AND permission_grant.status = 'ACTIVE'
        AND permission_grant.effective_from <= now()
        AND (permission_grant.effective_to IS NULL OR permission_grant.effective_to > now())
       LEFT JOIN organisation.organisation_role role
         ON role.id = permission_grant.role_id
        AND role.organisation_id = membership.organisation_id
        AND role.status = 'ACTIVE'
      WHERE membership.person_id = $1
        AND membership.status = 'ACTIVE'
        AND membership.valid_from <= now()
        AND (membership.valid_until IS NULL OR membership.valid_until > now())
      GROUP BY organisation.id, organisation.display_name, organisation.organisation_type,
               organisation.state, membership.id, membership.valid_until
      ORDER BY organisation.display_name, organisation.id`,
    [actor.personId]
  );
  return result.rows.map(summary);
}

type OrganisationContextRow = OrganisationSummaryRow & {
  permissions: ActorOrganisationContextProjection['permissions'];
  site_ids: string[];
  cost_centre_keys: string[];
  service_types: string[];
  passenger_group_refs: string[];
  active_site_count: string;
  active_cost_centre_count: string;
  active_agreement_count: string;
  active_restriction_count: string;
  open_approval_count: string;
  open_support_case_count: string;
};

export async function getActorOrganisationContext(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  organisationId: string
): Promise<ActorOrganisationContextProjection | null> {
  const result = await pool.query<OrganisationContextRow>(
    `SELECT organisation.id AS organisation_id,
            organisation.display_name,
            organisation.organisation_type,
            organisation.state AS organisation_state,
            membership.id AS membership_id,
            membership.valid_until AS membership_valid_until,
            membership.site_ids,
            membership.cost_centre_keys,
            membership.service_types,
            membership.passenger_group_refs,
            COALESCE((SELECT array_agg(DISTINCT role.role_family ORDER BY role.role_family)
                        FROM organisation.organisation_permission_grant_version grant_version
                        JOIN organisation.organisation_role role
                          ON role.id = grant_version.role_id
                         AND role.organisation_id = membership.organisation_id
                         AND role.status = 'ACTIVE'
                       WHERE grant_version.membership_id = membership.id
                         AND grant_version.organisation_id = membership.organisation_id
                         AND grant_version.status = 'ACTIVE'
                         AND grant_version.effective_from <= now()
                         AND (grant_version.effective_to IS NULL OR grant_version.effective_to > now())), ARRAY[]::text[]) AS role_families,
            COALESCE((SELECT array_agg(DISTINCT grant_version.permission ORDER BY grant_version.permission)
                        FROM organisation.organisation_permission_grant_version grant_version
                       WHERE grant_version.membership_id = membership.id
                         AND grant_version.organisation_id = membership.organisation_id
                         AND grant_version.status = 'ACTIVE'
                         AND grant_version.effective_from <= now()
                         AND (grant_version.effective_to IS NULL OR grant_version.effective_to > now())), ARRAY[]::text[]) AS permissions,
            (SELECT count(*)::text FROM organisation.organisation_site site
              WHERE site.organisation_id = organisation.id AND site.status = 'ACTIVE'
                AND site.operational_state = 'ACTIVE' AND site.effective_from <= now()
                AND (site.effective_to IS NULL OR site.effective_to > now())) AS active_site_count,
            (SELECT count(*)::text FROM organisation.cost_centre_version centre
              WHERE centre.organisation_id = organisation.id AND centre.status = 'ACTIVE'
                AND centre.effective_from <= now() AND (centre.effective_to IS NULL OR centre.effective_to > now())) AS active_cost_centre_count,
            (SELECT count(*)::text FROM organisation.organisation_agreement_version agreement
              WHERE agreement.organisation_id = organisation.id AND agreement.status = 'ACTIVE'
                AND agreement.effective_from <= now() AND (agreement.effective_to IS NULL OR agreement.effective_to > now())) AS active_agreement_count,
            (SELECT count(*)::text FROM organisation.organisation_restriction restriction
              WHERE restriction.organisation_id = organisation.id AND restriction.status = 'ACTIVE'
                AND restriction.effective_from <= now() AND (restriction.effective_to IS NULL OR restriction.effective_to > now())) AS active_restriction_count,
            (SELECT count(*)::text FROM organisation.organisation_approval_request approval
              WHERE approval.organisation_id = organisation.id AND approval.status = 'PENDING') AS open_approval_count,
            (SELECT count(*)::text FROM organisation.organisation_support_case support_case
              WHERE support_case.organisation_id = organisation.id AND support_case.status NOT IN ('RESOLVED','CLOSED')) AS open_support_case_count
       FROM organisation.organisation_user_membership membership
       JOIN organisation.organisation organisation ON organisation.id = membership.organisation_id
      WHERE membership.person_id = $1
        AND membership.organisation_id = $2
        AND membership.status = 'ACTIVE'
        AND membership.valid_from <= now()
        AND (membership.valid_until IS NULL OR membership.valid_until > now())`,
    [actor.personId, organisationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...summary(row),
    permissions: row.permissions,
    permittedSiteIds: row.site_ids,
    permittedCostCentreKeys: row.cost_centre_keys,
    permittedServiceTypes: row.service_types,
    permittedPassengerGroupReferences: row.passenger_group_refs,
    activeSiteCount: Number(row.active_site_count),
    activeCostCentreCount: Number(row.active_cost_centre_count),
    activeAgreementCount: Number(row.active_agreement_count),
    activeRestrictionCount: Number(row.active_restriction_count),
    openApprovalCount: Number(row.open_approval_count),
    openSupportCaseCount: Number(row.open_support_case_count),
    backendTenantIsolationEnforced: true,
    clientSuppliedOrganisationIdGrantsAccess: false,
    portalMutationEnabled: false,
    integrationExecutionEnabled: false
  };
}
