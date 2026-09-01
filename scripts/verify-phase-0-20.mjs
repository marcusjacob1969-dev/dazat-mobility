import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0020_institutional_live_operations_final_closure_foundation.sql',
  'packages/domain/src/institutional-live-operations.ts',
  'packages/contracts/src/institutional-live-operations.ts',
  'services/api/src/modules/institutional-live-operations/institutional-live-operations-service.ts',
  'services/api/src/modules/institutional-live-operations/routes.ts',
  'apps/organisation-portal/src/organisation-api.ts',
  'apps/organisation-portal/src/App.tsx',
  'apps/control-room/src/App.tsx',
  'docs/architecture/ADR-0020-institutional-live-operations-final-closure.md',
  'docs/engineering/phase-0-20-checklist.md',
  'docs/traceability/phase-0-20-requirements.md',
  'tests/domain/institutional-live-operations-source.test.mjs'
];
const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.20 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'organisation.institutional_operator_task_scope', 'organisation.institutional_attention_item',
  'organisation.institution_live_transport_exception', 'organisation.institution_live_exception_status_event',
  'organisation.institution_exception_resolution_verification', 'organisation.institution_readiness_assessment',
  'organisation.institution_readiness_dimension_result', 'organisation.institutional_manual_dispatch_assessment',
  'organisation.institutional_booking_execution_context', 'organisation.school_handover_execution',
  'organisation.authority_funding_execution', 'organisation.passenger_ready_state',
  'organisation.hospital_care_execution_context', 'organisation.guest_passenger_profile',
  'organisation.organisation_operational_contact', 'organisation.institutional_live_change_assessment',
  'organisation.institutional_canonical_outcome_assessment', 'organisation.institutional_continuity_execution_context',
  'organisation.institutional_safety_case_link', 'organisation.institutional_compliance_evidence_package',
  'organisation.institutional_compliance_evidence_item', 'organisation.institutional_data_quality_issue',
  'organisation.organisation_site_operational_profile_version', 'organisation.institution_disruption_event',
  'organisation.institution_disruption_impact', 'organisation.partner_overflow_assessment',
  'organisation.institutional_degraded_mode_decision', 'organisation.institutional_security_containment_decision',
  'organisation.institutional_live_tracking_grant', 'organisation.institutional_ai_assistance_record',
  'organisation.organisation_service_health', 'organisation.institutional_shift_handover',
  'organisation.institutional_shift_handover_item', 'organisation.institution_launch_readiness',
  'organisation.institution_launch_gate_result', 'organisation.institution_pilot',
  'organisation.institution_pilot_gate_result', 'organisation.institution_exit_plan',
  'organisation.institution_exit_inventory_item', 'organisation.institutional_live_acceptance_case_version',
  'organisation.institutional_live_command_deduplication', 'organisation.institutional_live_event',
  'organisation.institutional_live_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.20 persistence object: ${object}`);

for (const guarantee of [
  'direct_database_edit_allowed boolean NOT NULL DEFAULT false CHECK (direct_database_edit_allowed = false)',
  'replaces_specialised_case boolean NOT NULL DEFAULT false CHECK (replaces_specialised_case = false)',
  'auto_closes_linked_case boolean NOT NULL DEFAULT false CHECK (auto_closes_linked_case = false)',
  'forced_ineligible_assignment boolean NOT NULL DEFAULT false CHECK (forced_ineligible_assignment = false)',
  'passenger_personal_liability_created boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_created = false)',
  'emergency_medical_capability_claimed boolean NOT NULL DEFAULT false CHECK (emergency_medical_capability_claimed = false)',
  'raw_dbs_or_safeguarding_or_security_logs_included boolean NOT NULL DEFAULT false CHECK (raw_dbs_or_safeguarding_or_security_logs_included = false)',
  'original_booking_journey_preserved boolean NOT NULL CHECK (original_booking_journey_preserved = true)',
  'organisation_may_suppress_downgrade_or_close boolean NOT NULL DEFAULT false CHECK (organisation_may_suppress_downgrade_or_close = false)',
  'operator_invented_missing_data boolean NOT NULL DEFAULT false CHECK (operator_invented_missing_data = false)',
  'destroys_recurring_series boolean NOT NULL DEFAULT false CHECK (destroys_recurring_series = false)',
  'whole_organisation_roster_shared boolean NOT NULL DEFAULT false CHECK (whole_organisation_roster_shared = false)',
  'shadow_spreadsheet_or_personal_messaging_used boolean NOT NULL DEFAULT false CHECK (shadow_spreadsheet_or_personal_messaging_used = false)',
  'active_journeys_continue_safely boolean NOT NULL CHECK (active_journeys_continue_safely = true)',
  'general_employee_surveillance_allowed boolean NOT NULL DEFAULT false CHECK (general_employee_surveillance_allowed = false)',
  'independently_closed_safeguarding_case boolean NOT NULL DEFAULT false CHECK (independently_closed_safeguarding_case = false)',
  'automatically_cancels_bookings boolean NOT NULL DEFAULT false CHECK (automatically_cancels_bookings = false)',
  'sales_status_override_allowed boolean NOT NULL DEFAULT false CHECK (sales_status_override_allowed = false)',
  'automatic_expansion_allowed boolean NOT NULL DEFAULT false CHECK (automatic_expansion_allowed = false)',
  'active_passenger_abandonment_allowed boolean NOT NULL DEFAULT false CHECK (active_passenger_abandonment_allowed = false)',
  'external_execution_allowed boolean NOT NULL DEFAULT false CHECK (external_execution_allowed = false)',
  "scenario_number BETWEEN 72 AND 101",
  'UNIQUE (organisation_id, command_name, idempotency_key)'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.20 SQL guarantee: ${guarantee}`);

for (const boundary of [
  'guard_institutional_attention_update', 'institution_live_exception_update_guard',
  'institution_exception_resolution_verification_immutable', 'institution_readiness_assessment_immutable',
  'institutional_manual_dispatch_assessment_immutable', 'institutional_booking_execution_context_immutable',
  'school_handover_execution_immutable', 'authority_funding_execution_immutable',
  'passenger_ready_state_immutable', 'institutional_live_change_assessment_immutable',
  'institutional_canonical_outcome_assessment_immutable', 'institutional_continuity_execution_context_immutable',
  'institutional_safety_case_link_immutable', 'institutional_compliance_evidence_package_immutable',
  'guard_institutional_data_quality_update', 'organisation_site_operational_profile_version_immutable',
  'institution_disruption_event_immutable', 'partner_overflow_assessment_immutable',
  'institutional_degraded_mode_decision_immutable', 'institutional_security_containment_decision_immutable',
  'institutional_live_tracking_grant_immutable', 'institutional_ai_assistance_record_immutable',
  'organisation_service_health_immutable', 'guard_institutional_shift_handover_update',
  'Invalid institutional shift handover transition',
  'guard_institution_launch_readiness_update', 'Invalid institution launch readiness transition',
  'guard_institution_pilot_update', 'Invalid institution pilot transition',
  'guard_institution_exit_plan_update', 'Invalid institution exit plan transition',
  'institutional_live_acceptance_case_immutable',
  'institutional_live_command_dedup_immutable', 'institutional_live_event_immutable',
  'institutional_live_outbox_update_guard', 'institutional_live_outbox_delete_guard',
  'REFERENCES driver.driver_profile(id)', 'REFERENCES vehicle_fleet.vehicle(id)'
]) if (!sql.includes(boundary)) errors.push(`Missing Phase 0.20 SQL boundary: ${boundary}`);
if (sql.includes('REFERENCES driver.driver(id)') || sql.includes('REFERENCES fleet.vehicle(id)')) errors.push('Phase 0.20 migration contains a non-canonical Driver or vehicle foreign key');
if ((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length !== 43) errors.push('Phase 0.20 migration must define exactly 43 persistence tables');
if ((sql.match(/\$\$/g) ?? []).length % 2 !== 0) errors.push('Phase 0.20 migration has unbalanced dollar quotes');
const triggerCreates = (sql.match(/CREATE TRIGGER /g) ?? []).length + (sql.match(/CREATE CONSTRAINT TRIGGER /g) ?? []).length;
if (triggerCreates !== (sql.match(/DROP TRIGGER IF EXISTS /g) ?? []).length) errors.push('Phase 0.20 migration trigger declarations are unbalanced');

const domain = readFileSync(join(root, 'packages/domain/src/institutional-live-operations.ts'), 'utf8');
for (const boundary of [
  'INSTITUTIONAL_ATTENTION_PRIORITIES', 'INSTITUTION_TRANSPORT_EXCEPTION_CATEGORIES',
  'INSTITUTION_EXCEPTION_STATES', 'INSTITUTION_READINESS_OUTCOMES', 'PASSENGER_READY_STATES',
  'INSTITUTIONAL_LIVE_OUTCOMES', 'INSTITUTIONAL_LIVE_API_PATHS', 'INSTITUTIONAL_LIVE_COMMANDS',
  'INSTITUTIONAL_LIVE_EVENTS', 'INSTITUTIONAL_LIVE_P0_REQUIREMENTS', 'INSTITUTIONAL_LIVE_ACCEPTANCE_SCENARIOS',
  'evaluateInstitutionalWorkspaceAccess', 'directDatabaseEditingAllowed: false',
  'evaluateInstitutionTransportException', 'linkedCasesRemainIndependent: true',
  'evaluateInstitutionOccurrenceReadiness', 'driverGuaranteed: false',
  'evaluateManualInstitutionalDispatch', 'forcedAssignment: false',
  'evaluateInstitutionalBookingExecutionContext', 'evaluateSchoolHandoverExecution',
  'evaluateAuthorityFundingExecution', '!input.passengerPersonalLiabilityFallback',
  'evaluateHospitalPassengerReadiness', 'noShowRecorded: false',
  'evaluateEmployerFundedVisibility', 'evaluateGuestPassengerProfile',
  'evaluateInstitutionalLiveChange', 'evaluateInstitutionalOutcome', 'relabelled: false',
  'evaluateInstitutionalBreakdown', 'evaluateInstitutionalSafetyLink',
  'evaluateInstitutionalComplianceEvidence', 'evaluateInstitutionalDataQuality',
  'evaluateOrganisationSiteDisruption', 'evaluatePartnerOverflow',
  'evaluateInstitutionalDegradedMode', 'evaluateInstitutionalSecurityContainment',
  'evaluateInstitutionalPrivacyAndAi', 'evaluateOrganisationServiceHealth',
  'evaluateInstitutionalShiftHandover', 'evaluateInstitutionLaunchReadiness',
  'signedContractAloneSufficient: false', 'evaluateInstitutionExitPlan',
  'activePassengerAbandoned: false', 'institutionalLiveAcceptanceScenarioMayPass',
  'INSTITUTIONAL_SHADOW_TRIP_SYSTEM_ALLOWED = false', 'MANUAL_DISPATCH_BYPASSES_HARD_ELIGIBILITY = false',
  'ORGANISATION_MAY_CLOSE_SAFETY_CASE = false', 'SERVICE_HEALTH_AUTOMATICALLY_CANCELS_BOOKING = false',
  'SHADOW_SPREADSHEET_DISPATCH_ALLOWED = false', 'INSTITUTIONAL_AI_INVENTS_AUTHORITY = false',
  'SIGNED_CONTRACT_ALONE_ENABLES_LAUNCH = false', 'CONTRACT_EXIT_MAY_ABANDON_ACTIVE_PASSENGER = false',
  'INSTITUTIONAL_LIVE_MUTATIONS_ENABLED = false'
]) if (!domain.includes(boundary)) errors.push(`Missing institutional live domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/institutional-live-operations.ts'), 'utf8');
for (const truth of [
  'InstitutionalLiveOperationsCapabilitiesProjection', 'InstitutionalAttentionSummaryProjection',
  'InstitutionTransportExceptionSummaryProjection', 'InstitutionalLiveOperationsContextProjection',
  'canonicalBookingDispatchJourneyTruthPreserved: true', 'specialistSafetyFinanceRescueCasesRemainAuthoritative: true',
  'resolvedAndVerifiedRemainDistinct: true', 'manualDispatchBypassesEligibility: false',
  'serviceHealthAutomaticallyCancelsBooking: false', 'signedContractAloneEnablesLaunch: false',
  'exitMayAbandonActivePassenger: false', 'institutionalLiveMutationsEnabled: false',
  'tenantScopedByAuthenticatedMembership: true', 'readScopedByCurrentOperatorTask: true', 'passengerManifestSafetyAndFinanceDetailExcluded: true',
  'controlRoomMutationRequiresCurrentTaskScope: true', 'canonicalDomainTruthPreserved: true',
  'mutationEnabled: false', 'externalExecutionEnabled: false'
]) if (!contracts.includes(truth)) errors.push(`Missing institutional live contract truth: ${truth}`);

const service = readFileSync(join(root, 'services/api/src/modules/institutional-live-operations/institutional-live-operations-service.ts'), 'utf8');
for (const truth of [
  'getInstitutionalLiveOperationsCapabilities', 'getActorInstitutionalLiveOperationsContext',
  'WHERE membership.person_id = $1', 'membership.organisation_id = $2', "membership.status = 'ACTIVE'",
  'membership.valid_from <= now()', 'institutional_operator_task_scope', 'task_scope.operator_person_id = $1', 'LIMIT 50', 'tenantScopedByAuthenticatedMembership: true', 'readScopedByCurrentOperatorTask: true',
  'passengerManifestSafetyAndFinanceDetailExcluded: true', 'controlRoomMutationRequiresCurrentTaskScope: true',
  'canonicalDomainTruthPreserved: true', 'mutationEnabled: false', 'externalExecutionEnabled: false'
]) if (!service.includes(truth)) errors.push(`Missing institutional live service boundary: ${truth}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Institutional live service contains an external call');

const routes = readFileSync(join(root, 'services/api/src/modules/institutional-live-operations/routes.ts'), 'utf8');
for (const path of ['/v1/institutional-live-operations/capabilities', '/v1/organisations/:organisationId/live-operations']) {
  if (!routes.includes(path)) errors.push(`Institutional live API route missing: ${path}`);
}
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal', 'INVALID_ORGANISATION_ID', 'INSTITUTIONAL_LIVE_OPERATIONS_CONTEXT_NOT_FOUND']) {
  if (!routes.includes(gate)) errors.push(`Institutional live API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Institutional live routes expose an unapproved mutation');

const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const truth of ["readonly institutionalLiveMutationMode: 'disabled'", 'INSTITUTIONAL_LIVE_MUTATION_MODE must remain disabled', "institutionalLiveMutationMode: 'disabled'"]) {
  if (!config.includes(truth)) errors.push(`Configuration missing institutional live boundary: ${truth}`);
}
const environment = readFileSync(join(root, '.env.example'), 'utf8');
if (!environment.includes('INSTITUTIONAL_LIVE_MUTATION_MODE=disabled')) errors.push('Environment missing Phase 0.20 disabled truth');
const main = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const truth of ['registerInstitutionalLiveOperationsRoutes', 'NOT_REQUIRED_FOR_PHASE_0_20_INSTITUTIONAL_LIVE_OPERATIONS_FOUNDATION', 'institutionalLiveMutation']) {
  if (!main.includes(truth)) errors.push(`API bootstrap missing Phase 0.20 value: ${truth}`);
}
const mainPhase = main.match(/checkpoint:\s*'engineering-phase-0\.(\d+)'/)?.[1];
if (!mainPhase || Number(mainPhase) < 20) errors.push('API bootstrap checkpoint predates Phase 0.20');

const portal = readFileSync(join(root, 'apps/organisation-portal/src/App.tsx'), 'utf8');
for (const truth of ['ENGINEERING PHASE 0.20', 'The Control Room is a scoped lens, never a shadow trip system', 'RESOLVED', 'A signed contract alone cannot launch service', 'never abandons an active passenger']) {
  if (!portal.includes(truth)) errors.push(`Organisation Portal Part 4 boundary missing: ${truth}`);
}
const client = readFileSync(join(root, 'apps/organisation-portal/src/organisation-api.ts'), 'utf8');
for (const truth of ['readInstitutionalLiveOperationsCapabilities', 'readInstitutionalLiveOperationsContext', 'Authorization: `Bearer']) {
  if (!client.includes(truth)) errors.push(`Organisation Portal Part 4 client truth missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of ['ENGINEERING PHASE 0.20', 'Institutional operations stay canonical, owned and verifiable', 'RESOLVED never silently means VERIFIED', 'spreadsheet or personal-message shadow dispatch', 'A signed agreement alone never enables launch', 'never abandon an active passenger']) {
  if (!controlRoom.includes(truth)) errors.push(`Control Room Part 4 boundary missing: ${truth}`);
}

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/v1/institutional-live-operations/capabilities:', '/v1/organisations/{organisationId}/live-operations:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.20 path missing: ${path}`);
}
for (const truth of ['task-scoped lens over canonical Booking', 'resolved exceptions remain distinct from verified outcomes', 'InstitutionalLiveOperationsCapabilitiesProjection', 'InstitutionalLiveOperationsContextProjection', 'manualDispatchBypassesEligibility', 'signedContractAloneEnablesLaunch', 'ORG-AUT-002', 'ORG-HLT-002', 'ORG-PAR-001', 'ORG-SCH-005', 'ORG-SCH-006']) {
  if (!api.includes(truth)) errors.push(`OpenAPI Phase 0.20 truth missing: ${truth}`);
}
const openApiVersion = api.match(/version:\s*(0\.0\.\d+)/)?.[1];
if (!openApiVersion || Number(openApiVersion.split('.').at(-1)) < 20) errors.push('OpenAPI version predates Phase 0.20');

let currentVersion = null;
for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json', 'apps/organisation-portal/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (!/^0\.0\.\d+$/.test(parsed.version) || Number(parsed.version.split('.').at(-1)) < 20) errors.push(`${rel} version predates Phase 0.20`);
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
  console.error('DAZAT Engineering Phase 0.20 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.20 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus live attention, exception, readiness, sector, disruption, partner, degraded-mode, health, launch, pilot, exit and disabled-mutation boundaries.`);
