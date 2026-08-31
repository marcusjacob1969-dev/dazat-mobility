import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0019_organisation_agreement_policy_finance_governance_foundation.sql',
  'packages/domain/src/organisation-commercial-operations.ts',
  'packages/contracts/src/organisation-commercial-operations.ts',
  'services/api/src/modules/organisation-commercial-operations/organisation-commercial-operations-service.ts',
  'services/api/src/modules/organisation-commercial-operations/routes.ts',
  'apps/organisation-portal/src/organisation-api.ts',
  'apps/organisation-portal/src/App.tsx',
  'docs/architecture/ADR-0019-organisation-commercial-governance.md',
  'docs/engineering/phase-0-19-checklist.md',
  'docs/traceability/phase-0-19-requirements.md',
  'tests/domain/organisation-commercial-operations-source.test.mjs'
];
const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.19 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'organisation.organisation_agreement', 'organisation.organisation_agreement_status_event',
  'organisation.organisation_pricing_schedule_version', 'organisation.organisation_billing_policy_version',
  'organisation.billing_account', 'organisation.funding_reference',
  'organisation.purchase_order_reference', 'organisation.reporting_policy_version',
  'organisation.service_level_policy_version', 'organisation.service_level_measurement',
  'organisation.performance_causation_assessment', 'organisation.organisation_service_case',
  'organisation.corrective_action_plan', 'organisation.contract_change_request',
  'organisation.contract_policy_simulation', 'organisation.contract_policy_simulation_impact',
  'organisation.account_manager_assignment', 'organisation.service_credit_instruction',
  'organisation.organisation_credit_status', 'organisation.organisation_credit_status_event',
  'organisation.organisation_credit_override', 'organisation.future_booking_contract_classification',
  'organisation.urgent_commercial_exception', 'organisation.organisation_migration_batch',
  'organisation.organisation_migration_row', 'organisation.organisation_reinstatement_assessment',
  'organisation.organisation_commercial_acceptance_case_version',
  'organisation.organisation_commercial_command_deduplication',
  'organisation.organisation_commercial_event', 'organisation.organisation_commercial_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.19 persistence object: ${object}`);

for (const guarantee of [
  'contract_status_is_operational_organisation_status boolean NOT NULL DEFAULT false CHECK (contract_status_is_operational_organisation_status = false)',
  'owns_ledger_truth boolean NOT NULL DEFAULT false CHECK (owns_ledger_truth = false)',
  'direct_invoice_total_edit_allowed boolean NOT NULL DEFAULT false CHECK (direct_invoice_total_edit_allowed = false)',
  'passenger_personal_liability_fallback_allowed boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_fallback_allowed = false)',
  'ledger_account boolean NOT NULL DEFAULT false CHECK (ledger_account = false)',
  'passenger_personal_liability_created boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_created = false)',
  'edits_closed_invoice boolean NOT NULL DEFAULT false CHECK (edits_closed_invoice = false)',
  'raw_safety_default_allowed boolean NOT NULL DEFAULT false CHECK (raw_safety_default_allowed = false)',
  'diagnosis_default_allowed boolean NOT NULL DEFAULT false CHECK (diagnosis_default_allowed = false)',
  'target_claimed_as_guarantee boolean NOT NULL DEFAULT false CHECK (target_claimed_as_guarantee = false)',
  'safety_suppression_allowed boolean NOT NULL DEFAULT false CHECK (safety_suppression_allowed = false)',
  'stale_gps_used_as_proof boolean NOT NULL DEFAULT false CHECK (stale_gps_used_as_proof = false)',
  'canonical_classification_rewritten boolean NOT NULL DEFAULT false CHECK (canonical_classification_rewritten = false)',
  'allegation_is_automatic_finding boolean NOT NULL DEFAULT false CHECK (allegation_is_automatic_finding = false)',
  'completed_journeys_rewritten boolean NOT NULL DEFAULT false CHECK (completed_journeys_rewritten = false)',
  'active_journey_invalidated boolean NOT NULL DEFAULT false CHECK (active_journey_invalidated = false)',
  'production_writes_performed boolean NOT NULL DEFAULT false CHECK (production_writes_performed = false)',
  'passenger_personal_charge_allowed boolean NOT NULL DEFAULT false CHECK (passenger_personal_charge_allowed = false)',
  'ordinary_commercial_approval_falsified boolean NOT NULL DEFAULT false CHECK (ordinary_commercial_approval_falsified = false)',
  'legacy_approval_flags_trusted boolean NOT NULL DEFAULT false CHECK (legacy_approval_flags_trusted = false)',
  'legacy_approved_driver_bypass_used boolean NOT NULL DEFAULT false CHECK (legacy_approved_driver_bypass_used = false)',
  'old_api_credentials_blindly_restored boolean NOT NULL DEFAULT false CHECK (old_api_credentials_blindly_restored = false)',
  'external_execution_allowed boolean NOT NULL DEFAULT false CHECK (external_execution_allowed = false)',
  "status NOT IN ('APPROVED','ACTIVATED') OR cardinality(approval_evidence_references) > 0",
  'CHECK (ordinary_commercial_approval_outstanding = true)'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.19 SQL guarantee: ${guarantee}`);

for (const boundary of [
  'guard_commercial_version_close_update', 'organisation_commercial_agreement_update_guard',
  'organisation_pricing_schedule_update_guard', 'organisation_billing_policy_update_guard',
  'billing_account_update_guard', 'Invalid billing account transition',
  'funding_reference_immutable', 'purchase_order_reference_immutable',
  'reporting_policy_update_guard', 'service_level_policy_update_guard',
  'service_level_measurement_immutable', 'performance_causation_assessment_immutable',
  'organisation_service_case_update_guard', 'Invalid organisation service case transition',
  'corrective_action_update_guard', 'contract_change_request_update_guard',
  'contract_policy_simulation_update_guard', 'contract_policy_simulation_impact_immutable',
  'account_manager_assignment_immutable',
  'service_credit_instruction_immutable', 'organisation_credit_status_update_guard',
  'Invalid organisation agreement transition', 'Invalid organisation credit status transition',
  'organisation_credit_override_immutable', 'future_booking_contract_classification_immutable',
  'urgent_commercial_exception_immutable', 'organisation_migration_batch_update_guard',
  'Invalid organisation migration batch transition', 'organisation_migration_row_immutable',
  'organisation_reinstatement_assessment_immutable', 'organisation_commercial_acceptance_case_immutable',
  'organisation_commercial_command_dedup_immutable', 'organisation_commercial_event_immutable',
  'organisation_commercial_outbox_update_guard',
  'UNIQUE (organisation_id, command_name, idempotency_key)',
  "scenario_number BETWEEN 53 AND 71",
  "classification IN ('COVERED','RENEWAL_DEPENDENT','REAPPROVAL_REQUIRED','INVALID','MANUAL_REVIEW')"
]) if (!sql.includes(boundary)) errors.push(`Missing Phase 0.19 SQL boundary: ${boundary}`);
if ((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length !== 30) errors.push('Phase 0.19 migration must define exactly 30 persistence tables');
if ((sql.match(/\$\$/g) ?? []).length % 2 !== 0) errors.push('Phase 0.19 migration has unbalanced dollar quotes');
const triggerCreates = (sql.match(/CREATE TRIGGER /g) ?? []).length + (sql.match(/CREATE CONSTRAINT TRIGGER /g) ?? []).length;
if (triggerCreates !== (sql.match(/DROP TRIGGER IF EXISTS /g) ?? []).length) errors.push('Phase 0.19 migration trigger declarations are unbalanced');

const domain = readFileSync(join(root, 'packages/domain/src/organisation-commercial-operations.ts'), 'utf8');
for (const boundary of [
  'ORGANISATION_AGREEMENT_STATES', 'INSTITUTIONAL_APPROVAL_DECISIONS',
  'ORGANISATION_CREDIT_STATES', 'ORGANISATION_COMMERCIAL_RESTRICTION_SCOPES',
  'INSTITUTIONAL_EVENT_CLASSIFICATIONS', 'ORGANISATION_COMMERCIAL_API_PATHS',
  'ORGANISATION_COMMERCIAL_COMMANDS', 'ORGANISATION_COMMERCIAL_EVENTS',
  'ORGANISATION_COMMERCIAL_P0_REQUIREMENTS', 'ORGANISATION_COMMERCIAL_ACCEPTANCE_SCENARIOS',
  'evaluateAgreementVersion', 'CONTRACT_AND_OPERATIONAL_STATUS_MUST_REMAIN_SEPARATE',
  'evaluateOrganisationPolicyPrecedence', 'HARD_PROTECTION_DOWNGRADE_PROHIBITED',
  'evaluateInstitutionalApproval', 'approvalCreatesAssignment: false',
  'evaluateUrgentCommercialException', 'PROCEED_CONTINUITY',
  'evaluateInstitutionalBilling', 'passengerLiabilityCreated: false', 'ledgerEdited: false',
  'evaluateOrganisationCreditControl', 'personalChargeAllowed: false',
  'evaluateServiceLevelMeasurement', 'classificationRewritten: false',
  'evaluateOrganisationAllegation', 'findingCreatedByAllegation: false',
  'evaluateContractPolicySimulation', 'productionMutated: false',
  'evaluateOrganisationIntegration', 'replayDeduplicated',
  'organisationCommercialExportMayRun', 'evaluateOrganisationExitOrReinstatement',
  'evaluateOrganisationMigration', 'legacyBypassAccepted: false',
  'evaluateOrganisationPortalAccess', 'uiVisibilityIsAuthority: false',
  'evaluateContractualRemedy', 'organisationCommercialAcceptanceScenarioMayPass',
  'COMMERCIAL_CONTRACT_OVERRIDES_HARD_PROTECTION = false',
  'APPROVAL_CREATES_DRIVER_ASSIGNMENT = false', 'ORGANISATION_DEBT_CHARGES_PASSENGER_METHOD = false',
  'SLA_MAY_REWRITE_CANONICAL_CLASSIFICATION = false',
  'MIGRATION_LEGACY_FLAGS_BYPASS_CURRENT_ELIGIBILITY = false',
  'ORGANISATION_COMMERCIAL_MUTATIONS_ENABLED = false'
]) if (!domain.includes(boundary)) errors.push(`Missing organisation commercial domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/organisation-commercial-operations.ts'), 'utf8');
for (const truth of [
  'OrganisationCommercialCapabilitiesProjection', 'OrganisationRenewalRiskSummaryProjection',
  'OrganisationCommercialContextProjection', 'contractAndOperationalStatusSeparated: true',
  'agreementPolicyAndPricingVersionedSeparately: true', 'hardProtectionPrecedencePreserved: true',
  'approvalCreatesDriverAssignment: false', 'billingConfigurationEditsLedger: false',
  'organisationDebtChargesPassengerMethod: false', 'migrationLegacyBypassAllowed: false',
  'organisationCommercialMutationsEnabled: false', 'tenantScopedByAuthenticatedMembership: true',
  'passengerAndSafeguardingDataExcluded: true', 'canonicalFinanceAndBookingTruthPreserved: true',
  'mutationEnabled: false', 'externalExecutionEnabled: false'
]) if (!contracts.includes(truth)) errors.push(`Missing organisation commercial contract truth: ${truth}`);

const service = readFileSync(join(root, 'services/api/src/modules/organisation-commercial-operations/organisation-commercial-operations-service.ts'), 'utf8');
for (const truth of [
  'getOrganisationCommercialCapabilities', 'getActorOrganisationCommercialContext',
  'WHERE membership.person_id = $1', 'membership.organisation_id = $2',
  "membership.status = 'ACTIVE'", 'membership.valid_from <= now()',
  'LIMIT 50', 'tenantScopedByAuthenticatedMembership: true',
  'passengerAndSafeguardingDataExcluded: true', 'canonicalFinanceAndBookingTruthPreserved: true',
  'mutationEnabled: false', 'externalExecutionEnabled: false'
]) if (!service.includes(truth)) errors.push(`Missing organisation commercial service boundary: ${truth}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Organisation commercial service contains an external call');

const routes = readFileSync(join(root, 'services/api/src/modules/organisation-commercial-operations/routes.ts'), 'utf8');
for (const path of ['/v1/organisation-commercial-operations/capabilities', '/v1/organisations/:organisationId/commercial-operations']) {
  if (!routes.includes(path)) errors.push(`Organisation commercial API route missing: ${path}`);
}
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal', 'INVALID_ORGANISATION_ID', 'ORGANISATION_COMMERCIAL_CONTEXT_NOT_FOUND']) {
  if (!routes.includes(gate)) errors.push(`Organisation commercial API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Organisation commercial routes expose an unapproved mutation');

const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const truth of [
  "readonly organisationCommercialMutationMode: 'disabled'",
  'ORGANISATION_COMMERCIAL_MUTATION_MODE must remain disabled',
  "organisationCommercialMutationMode: 'disabled'"
]) if (!config.includes(truth)) errors.push(`Configuration missing organisation commercial boundary: ${truth}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
if (!environment.includes('ORGANISATION_COMMERCIAL_MUTATION_MODE=disabled')) errors.push('Environment missing Phase 0.19 disabled truth');
const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
for (const truth of [
  'registerOrganisationCommercialOperationsRoutes',
  'organisationCommercialMutation'
]) if (!main.includes(truth)) errors.push(`API bootstrap missing Phase 0.19 value: ${truth}`);
const mainPhase = main.match(/checkpoint:\s*'engineering-phase-0\.(\d+)'/)?.[1];
if (!mainPhase || Number(mainPhase) < 19) errors.push('API bootstrap checkpoint predates Phase 0.19');

const portal = readFileSync(join(root, 'apps/organisation-portal/src/App.tsx'), 'utf8');
for (const truth of [
  'A contract shapes service — it never weakens hard protection',
  'Approval is not Booking confirmation or a Driver assignment',
  'Targets, credit and contract exit remain truthful',
  'Stale GPS is not proof of lateness or no-show', 'migration flags never bypass current eligibility'
]) if (!portal.includes(truth)) errors.push(`Organisation Portal Part 3 boundary missing: ${truth}`);
const portalPhase = portal.match(/ENGINEERING PHASE 0\.(\d+)/)?.[1];
if (!portalPhase || Number(portalPhase) < 19) errors.push('Organisation Portal checkpoint predates Phase 0.19');
const client = readFileSync(join(root, 'apps/organisation-portal/src/organisation-api.ts'), 'utf8');
for (const truth of ['readOrganisationCommercialCapabilities', 'readOrganisationCommercialContext', 'Authorization: `Bearer']) {
  if (!client.includes(truth)) errors.push(`Organisation Portal Part 3 client truth missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Commercial state cannot override active service or canonical truth',
  'Approval does not assign a Driver', 'an SLA target cannot rewrite canonical lateness',
  'Active-journey Safety, breakdown continuity and school safeguarding outrank unresolved commercial approval',
  'organisation commercial mutations remain disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room Part 3 boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/v1/organisation-commercial-operations/capabilities:', '/v1/organisations/{organisationId}/commercial-operations:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.19 path missing: ${path}`);
}
for (const truth of [
  'OrganisationCommercialCapabilitiesProjection', 'OrganisationCommercialContextProjection',
  'contractAndOperationalStatusSeparated', 'organisationCommercialMutationsEnabled',
  'ORG-AGR-001', 'OrganisationPolicySimulationCompleted.v1'
]) if (!api.includes(truth)) errors.push(`OpenAPI Phase 0.19 truth missing: ${truth}`);
const apiVersion = api.match(/\n\s*version:\s*0\.0\.(\d+)/)?.[1];
if (!apiVersion || Number(apiVersion) < 19) errors.push('OpenAPI version predates Phase 0.19');

let currentVersion = null;
for (const rel of [
  'package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json',
  'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json', 'apps/organisation-portal/package.json'
]) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const patch = Number(String(parsed.version).split('.')[2]);
  if (!Number.isInteger(patch) || patch < 19) errors.push(`${rel} version predates Phase 0.19`);
  currentVersion ??= parsed.version;
  if (parsed.version !== currentVersion) errors.push(`${rel} is not aligned to the current checkpoint version`);
}
const contractsPackage = JSON.parse(readFileSync(join(root, 'packages/contracts/package.json'), 'utf8'));
if (contractsPackage.dependencies['@dazat/domain'] !== currentVersion) errors.push('Contracts domain dependency is not aligned');
const apiPackage = JSON.parse(readFileSync(join(root, 'services/api/package.json'), 'utf8'));
if (apiPackage.dependencies['@dazat/domain'] !== currentVersion || apiPackage.dependencies['@dazat/contracts'] !== currentVersion) errors.push('API internal dependencies are not aligned');
for (const rel of ['apps/driver/package.json', 'apps/rider/package.json', 'apps/organisation-portal/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.dependencies['@dazat/contracts'] !== currentVersion) errors.push(`${rel} contract dependency is not aligned`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.19 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.19 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus agreement, policy, approval, billing, credit, SLA, integration, lifecycle, migration and disabled-mutation boundaries.`);
