import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0017_organisation_identity_tenancy_authority_foundation.sql',
  'packages/domain/src/organisation-operations.ts',
  'packages/contracts/src/organisation-operations.ts',
  'services/api/src/modules/organisation-operations/organisation-operations-service.ts',
  'services/api/src/modules/organisation-operations/routes.ts',
  'apps/organisation-portal/package.json',
  'apps/organisation-portal/src/App.tsx',
  'apps/organisation-portal/src/organisation-api.ts',
  'docs/architecture/ADR-0017-organisation-identity-tenancy-authority.md',
  'docs/engineering/phase-0-17-checklist.md',
  'docs/traceability/phase-0-17-requirements.md',
  'tests/domain/organisation-operations-source.test.mjs'
];
const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.17 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'organisation.organisation', 'organisation.organisation_lifecycle_transition',
  'organisation.organisation_legal_profile_version', 'organisation.organisation_site',
  'organisation.cost_centre_version', 'organisation.organisation_contact_version',
  'organisation.organisation_role', 'organisation.organisation_user_membership',
  'organisation.organisation_membership_status_event', 'organisation.organisation_permission_grant_version',
  'organisation.organisation_invitation', 'organisation.organisation_restriction',
  'organisation.organisation_service_policy_version', 'organisation.organisation_agreement_version',
  'organisation.organisation_communication_policy_version', 'organisation.organisation_passenger_roster_entry',
  'organisation.booking_authority_rule_version', 'organisation.booking_funding_instruction',
  'organisation.organisation_approval_policy_version', 'organisation.organisation_approval_request',
  'organisation.organisation_support_case', 'organisation.organisation_api_client',
  'organisation.organisation_api_credential_version', 'organisation.organisation_webhook_subscription',
  'organisation.organisation_webhook_delivery', 'organisation.organisation_export_request',
  'organisation.organisation_audit_event', 'organisation.organisation_acceptance_case_version',
  'organisation.organisation_command_deduplication', 'organisation.organisation_event',
  'organisation.organisation_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.17 persistence object: ${object}`);

for (const guarantee of [
  'legal_status_inferred boolean NOT NULL DEFAULT false CHECK (legal_status_inferred = false)',
  'safeguarding_authority_inferred boolean NOT NULL DEFAULT false CHECK (safeguarding_authority_inferred = false)',
  'passenger_identity_ownership_claimed boolean NOT NULL DEFAULT false CHECK (passenger_identity_ownership_claimed = false)',
  'universal_admin boolean NOT NULL DEFAULT false CHECK (universal_admin = false)',
  'finance_ledger boolean NOT NULL DEFAULT false CHECK (finance_ledger = false)',
  'membership_alone_is_booking_authority boolean NOT NULL DEFAULT false CHECK (membership_alone_is_booking_authority = false)',
  'accessibility_requirements_preserved boolean NOT NULL DEFAULT true CHECK (accessibility_requirements_preserved = true)',
  'universal_safety_functions_preserved boolean NOT NULL DEFAULT true CHECK (universal_safety_functions_preserved = true)',
  'active_journey_termination_allowed boolean NOT NULL DEFAULT false CHECK (active_journey_termination_allowed = false)',
  'human_permissions_inherited boolean NOT NULL DEFAULT false CHECK (human_permissions_inherited = false)',
  'external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false)',
  'canonical_booking_state_changed_by_delivery_failure boolean NOT NULL DEFAULT false CHECK (canonical_booking_state_changed_by_delivery_failure = false)',
  'raw_safety_evidence_included boolean NOT NULL DEFAULT false CHECK (raw_safety_evidence_included = false)',
  'unrelated_passenger_journeys_included boolean NOT NULL DEFAULT false CHECK (unrelated_passenger_journeys_included = false)',
  'external_integration_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_integration_execution_enabled = false)'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.17 SQL guarantee: ${guarantee}`);

for (const boundary of [
  'organisation_update_guard', 'organisation_legal_profile_update_guard', 'organisation_site_update_guard',
  'cost_centre_version_update_guard', 'organisation_role_update_guard', 'organisation_membership_update_guard',
  'organisation_permission_grant_update_guard', 'organisation_invitation_update_guard',
  'organisation_restriction_update_guard', 'organisation_service_policy_update_guard',
  'organisation_agreement_update_guard', 'organisation_passenger_roster_entry_update_guard',
  'booking_authority_rule_update_guard',
  'organisation_approval_request_update_guard', 'organisation_support_case_update_guard',
  'organisation_api_client_update_guard', 'organisation_api_credential_update_guard',
  'organisation_webhook_subscription_update_guard', 'organisation_export_request_update_guard',
  'organisation_event_immutable',
  'one_active_person_roster_entry', 'one_active_managed_passenger_roster_entry',
  'organisation_command_deduplication_immutable', 'organisation_audit_event_immutable',
  'UNIQUE (organisation_id, command_type, idempotency_key)',
  "event_type IN (", "'OrganisationCreated.v1'", "'OrganisationClosed.v1'"
]) if (!sql.includes(boundary)) errors.push(`Missing Phase 0.17 SQL boundary: ${boundary}`);
if ((sql.match(/\$\$/g) ?? []).length % 2 !== 0) errors.push('Migration has unbalanced PostgreSQL dollar quotes');
if ((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length !== 31) errors.push('Phase 0.17 migration must define exactly 31 persistence tables');

const domain = readFileSync(join(root, 'packages/domain/src/organisation-operations.ts'), 'utf8');
for (const boundary of [
  'ORGANISATION_TYPES', 'ORGANISATION_LIFECYCLE_STATES', 'ORGANISATION_MEMBERSHIP_STATES',
  'ORGANISATION_ROLE_FAMILIES', 'ORGANISATION_PERMISSIONS', 'ORGANISATION_RESTRICTION_SCOPES',
  'ORGANISATION_CONCEPTUAL_API_PATHS', 'ORGANISATION_CORE_EVENTS', 'ORGANISATION_P0_REQUIREMENTS',
  'ORGANISATION_ACCEPTANCE_SCENARIOS', 'evaluateOrganisationLifecycleTransition',
  'evaluateOrganisationTenantAccess', 'CROSS_TENANT_ACCESS_DENIED', 'SITE_SCOPE_DENIED',
  'evaluateOrganisationCapability', 'UNIVERSAL_ADMIN_PROHIBITED', 'FOUR_EYES_REVIEW_REQUIRED',
  'evaluateOrganisationInvitationAcceptance', 'evaluateOrganisationBookingAuthority',
  'BOOKING_PARTIES_MUST_REMAIN_DISTINCT', 'evaluateOrganisationServicePolicy',
  'CONTINUE_SAFE_HANDLING_RECONCILE_AFTER', 'evaluateOrganisationApproval',
  'evaluateOrganisationRestriction', 'organisationExportMayRun',
  'evaluateOrganisationIntegrationRequest', 'REPLAY_DEDUPLICATED',
  'evaluateOrganisationOffboarding', 'PASSENGER_IDENTITY_HISTORY_DELETION_PROHIBITED',
  'organisationAcceptanceScenarioMayPass', 'UNIVERSAL_ORGANISATION_ADMIN_ALLOWED = false',
  'CLIENT_ENFORCED_TENANT_SCOPE_ACCEPTABLE = false', 'ORGANISATION_OWNS_PASSENGER_IDENTITY = false',
  'ORGANISATION_POLICY_MAY_DISABLE_SAFETY_OR_ACCESSIBILITY = false',
  'COST_CENTRE_IS_FINANCE_LEDGER = false', 'WEBHOOK_FAILURE_MUTATES_CANONICAL_BOOKING = false',
  'ORGANISATION_SSO_GRANTS_DAZAT_PERMISSION = false', 'ORGANISATION_PORTAL_DIRECT_DATABASE_EDITING = false',
  'ORGANISATION_EXTERNAL_INTEGRATION_EXECUTION_ENABLED = false', 'ORGANISATION_STAFF_MUTATIONS_ENABLED = false'
]) if (!domain.includes(boundary)) errors.push(`Missing Organisation domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/organisation-operations.ts'), 'utf8');
for (const projection of [
  'OrganisationOperationsCapabilitiesProjection', 'ActorOrganisationSummaryProjection',
  'ActorOrganisationContextProjection', 'backendTenantIsolationEnforced: true',
  'bookingAuthoritySeparatedFromMembership: true', 'organisationOwnsPassengerIdentity: false',
  'universalOrganisationAdminAllowed: false', 'portalDirectDatabaseEditingAllowed: false',
  'organisationStaffMutationsEnabled: false', 'externalIntegrationExecutionEnabled: false',
  'tenantScopedByAuthenticatedPerson: true', 'clientSuppliedOrganisationIdGrantsAccess: false'
]) if (!contracts.includes(projection)) errors.push(`Missing Organisation contract truth: ${projection}`);

const service = readFileSync(join(root, 'services/api/src/modules/organisation-operations/organisation-operations-service.ts'), 'utf8');
for (const boundary of [
  'getOrganisationOperationsCapabilities', 'listActorOrganisations', 'getActorOrganisationContext',
  'WHERE membership.person_id = $1', 'membership.organisation_id = $2',
  "membership.status = 'ACTIVE'", 'membership.valid_from <= now()',
  'permission_grant.organisation_id = membership.organisation_id',
  'tenantScopedByAuthenticatedPerson: true', 'backendTenantIsolationEnforced: true',
  'clientSuppliedOrganisationIdGrantsAccess: false', 'portalMutationEnabled: false',
  'integrationExecutionEnabled: false'
]) if (!service.includes(boundary)) errors.push(`Missing Organisation service boundary: ${boundary}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Organisation service contains an unapproved external integration call');

const routes = readFileSync(join(root, 'services/api/src/modules/organisation-operations/routes.ts'), 'utf8');
for (const path of ['/v1/organisations/capabilities', "'/v1/organisations'", '/v1/organisations/:organisationId/context']) {
  if (!routes.includes(path)) errors.push(`Organisation API route missing: ${path}`);
}
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal', 'INVALID_ORGANISATION_ID', 'ORGANISATION_CONTEXT_NOT_FOUND']) {
  if (!routes.includes(gate)) errors.push(`Organisation API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Organisation routes expose an unapproved mutation');

const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const value of [
  "readonly organisationMutationMode: 'disabled'", "readonly organisationIntegrationMode: 'disabled'",
  'ORGANISATION_MUTATION_MODE must remain disabled', 'ORGANISATION_INTEGRATION_MODE must remain disabled',
  "organisationMutationMode: 'disabled'", "organisationIntegrationMode: 'disabled'"
]) if (!config.includes(value)) errors.push(`API configuration missing Organisation disable boundary: ${value}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
for (const value of ['ORGANISATION_MUTATION_MODE=disabled', 'ORGANISATION_INTEGRATION_MODE=disabled']) {
  if (!environment.includes(value)) errors.push(`Environment missing disabled Phase 0.17 truth: ${value}`);
}
const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
for (const value of ['registerOrganisationOperationsRoutes', 'organisationMutation', 'organisationIntegration']) {
  if (!main.includes(value)) errors.push(`API bootstrap missing Phase 0.17 value: ${value}`);
}
const mainPhase = main.match(/checkpoint:\s*'engineering-phase-0\.(\d+)'/)?.[1];
if (!mainPhase || Number(mainPhase) < 17) errors.push('API bootstrap checkpoint predates Phase 0.17');

const portal = readFileSync(join(root, 'apps/organisation-portal/src/App.tsx'), 'utf8');
for (const truth of [
  'backend enforces organisation, site, cost-centre, purpose and permission scope',
  'does not own the passenger', 'There is no universal organisation admin',
  'Portal editing and integrations are disabled', 'never a direct database editor',
  'Offboarding revokes organisation authority'
]) if (!portal.includes(truth)) errors.push(`Organisation Portal boundary missing: ${truth}`);
const portalPhase = portal.match(/ENGINEERING PHASE 0\.(\d+)/)?.[1];
if (!portalPhase || Number(portalPhase) < 17) errors.push('Organisation Portal checkpoint predates Phase 0.17');
const portalClient = readFileSync(join(root, 'apps/organisation-portal/src/organisation-api.ts'), 'utf8');
for (const truth of ['readOrganisationCapabilities', 'readActorOrganisations', 'readActorOrganisationContext', 'Authorization: `Bearer']) {
  if (!portalClient.includes(truth)) errors.push(`Organisation Portal client truth missing: ${truth}`);
}
if (!portalClient.includes("method: 'GET'")) errors.push('Organisation Portal client must be explicitly read-only');
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Organisation access is tenant-, role- and purpose-scoped', 'Membership is not universal authority',
  'cannot make an organisation own a passenger', 'cannot strand an active Journey',
  'Organisation mutations, external API execution, webhook delivery, export execution and direct database editing remain disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room Organisation boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/v1/organisations/capabilities:', '/v1/organisations:', '/v1/organisations/{organisationId}/context:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.17 path missing: ${path}`);
}
for (const statement of [
  'not a second Booking engine', 'not an owner of passenger identity',
  'backend enforces active membership', 'cost centres are not Finance ledger truth',
  'OrganisationOperationsCapabilitiesProjection', 'ActorOrganisationContextProjection',
  'organisationStaffMutationsEnabled', 'externalIntegrationExecutionEnabled',
  'ORG-TEN-001', 'OrganisationCreated.v1'
]) if (!api.includes(statement)) errors.push(`OpenAPI Organisation truth statement missing: ${statement}`);
const apiVersion = api.match(/\n\s*version:\s*0\.0\.(\d+)/)?.[1];
if (!apiVersion || Number(apiVersion) < 17) errors.push('OpenAPI version predates Phase 0.17');

let currentVersion = null;
for (const rel of [
  'package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json',
  'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json', 'apps/organisation-portal/package.json'
]) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const patch = Number(String(parsed.version).split('.')[2]);
  if (!Number.isInteger(patch) || patch < 17) errors.push(`${rel} version predates Phase 0.17`);
  currentVersion ??= parsed.version;
  if (parsed.version !== currentVersion) errors.push(`${rel} is not aligned to the current checkpoint version`);
}
const contractsPackage = JSON.parse(readFileSync(join(root, 'packages/contracts/package.json'), 'utf8'));
if (contractsPackage.dependencies['@dazat/domain'] !== currentVersion) errors.push('Contracts domain dependency is not aligned');
const apiPackage = JSON.parse(readFileSync(join(root, 'services/api/package.json'), 'utf8'));
if (apiPackage.dependencies['@dazat/domain'] !== currentVersion || apiPackage.dependencies['@dazat/contracts'] !== currentVersion) {
  errors.push('API internal dependencies are not aligned');
}
for (const rel of ['apps/driver/package.json', 'apps/rider/package.json', 'apps/organisation-portal/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.dependencies['@dazat/contracts'] !== currentVersion) errors.push(`${rel} contract dependency is not aligned`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.17 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.17 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus identity, tenancy, role, authority, approval, integration, export, offboarding and disabled-execution boundaries.`);
