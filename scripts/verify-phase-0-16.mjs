import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0016_communications_engine_final_closure_foundation.sql',
  'packages/domain/src/communications-closure.ts',
  'packages/contracts/src/communications-closure.ts',
  'services/api/src/modules/communications-closure/communications-closure-service.ts',
  'services/api/src/modules/communications-closure/routes.ts',
  'apps/rider/src/communications-operations-api.ts',
  'apps/driver/src/communications-operations-api.ts',
  'docs/architecture/ADR-0016-communications-engine-final-closure.md',
  'docs/engineering/phase-0-16-checklist.md',
  'docs/traceability/phase-0-16-requirements.md',
  'tests/domain/communications-closure-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.16 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'communications.canonical_event_envelope',
  'communications.communication_event_contract_version',
  'communications.communication_api_contract_version',
  'communications.communication_p0_requirement_version',
  'communications.communication_request_contract',
  'communications.recipient_permission_resolution',
  'communications.delivery_path_resolution',
  'communications.communications_degraded_mode_decision',
  'communications.communication_acceptance_case_version',
  'communications.communication_acceptance_result',
  'communications.communication_launch_gate_version',
  'communications.communication_launch_gate_evidence',
  'communications.communications_closure_event',
  'communications.communications_closure_command_deduplication',
  'communications.communications_closure_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.16 persistence object: ${object}`);
for (const guarantee of [
  'payload_schema_supported boolean NOT NULL DEFAULT true',
  'endpoint_call_grants_domain_authority boolean NOT NULL DEFAULT false',
  'production_verified boolean NOT NULL DEFAULT false',
  'sensitive_message_content_included boolean NOT NULL DEFAULT false',
  'payload_contains_arbitrary_source_object boolean NOT NULL DEFAULT false',
  'priority_grants_additional_data_access boolean NOT NULL DEFAULT false',
  'raw_contact_accepted_from_source_domain boolean NOT NULL DEFAULT false',
  'business_state_invented_by_communications boolean NOT NULL DEFAULT false',
  'unrestricted_relationship_visibility_granted boolean NOT NULL DEFAULT false',
  'internal_case_notes_included boolean NOT NULL DEFAULT false',
  'provider_acceptance_treated_as_delivery boolean NOT NULL DEFAULT false',
  'stale_fallback_allowed boolean NOT NULL DEFAULT false',
  'risky_change_failed_open boolean NOT NULL DEFAULT false',
  'active_journey_stranded_by_shield_outage boolean NOT NULL DEFAULT false',
  'fixture_only boolean NOT NULL DEFAULT true',
  'real_user_contact_allowed boolean NOT NULL DEFAULT false',
  'external_provider_execution_allowed boolean NOT NULL DEFAULT false',
  'contacted_real_user boolean NOT NULL DEFAULT false',
  'external_provider_called boolean NOT NULL DEFAULT false',
  'production_execution_enabled boolean NOT NULL DEFAULT false',
  'external_provider_execution_enabled boolean NOT NULL DEFAULT false'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.16 SQL guarantee: ${guarantee}`);
for (const boundary of [
  "event_type ~ '\\.v[1-9][0-9]*$'", 'UNIQUE (source_domain, idempotency_key)',
  "recipient_role <> 'CONTROL_ROOM_OPERATOR' OR active_task_reference IS NOT NULL",
  'acknowledgement_required boolean NOT NULL',
  "terminal_action <> 'COMPLETE' OR primary_attempt_state = 'ACKNOWLEDGED'",
  "terminal_action <> 'ATTEMPT_FALLBACK' OR (fallback_triggered AND source_current)",
  "action <> 'PAUSE_HIGH_RISK_CHANGE' OR (NOT shield_available AND high_risk_account_or_financial_change)",
  "status <> 'PASS' OR (authoritative_state_revalidated AND recipient_permissions_respected)",
  "status <> 'PASS' OR (evidence_reference IS NOT NULL AND assessed_by_person_id IS NOT NULL)",
  'canonical_event_envelope_immutable', 'communication_request_contract_immutable',
  'communication_event_contract_version_update_guard', 'communication_api_contract_version_update_guard',
  'communication_p0_requirement_version_update_guard',
  'recipient_permission_resolution_immutable', 'delivery_path_resolution_immutable',
  'communications_degraded_mode_decision_immutable', 'communication_acceptance_result_immutable',
  'communication_launch_gate_evidence_immutable', 'communications_closure_event_immutable'
]) if (!sql.includes(boundary)) errors.push(`Missing Phase 0.16 SQL boundary: ${boundary}`);

const domain = readFileSync(join(root, 'packages/domain/src/communications-closure.ts'), 'utf8');
for (const boundary of [
  'COMMUNICATION_SOURCE_DOMAINS', 'COMMUNICATION_RECIPIENT_ROLES',
  'CRITICAL_COMMUNICATION_EVENT_TYPES', 'COMMUNICATION_CONCEPTUAL_API_OPERATIONS',
  'COMMUNICATION_P0_REQUIREMENTS',
  'COMMUNICATION_ACCEPTANCE_SCENARIOS', 'COMMUNICATION_LAUNCH_GATES',
  'evaluateCanonicalCommunicationRequest', 'IDEMPOTENCY_KEY_REQUIRED',
  'IMMUTABLE_SOURCE_EVENT_REQUIRED', 'ARBITRARY_SOURCE_OBJECT_DUMP_PROHIBITED',
  'STALE_AUTHORITATIVE_STATE_SUPPRESSED', 'evaluateCommunicationEventEnvelope',
  'VERSIONED_EVENT_TYPE_REQUIRED', 'DUPLICATE_EVENT_DEDUPLICATED',
  'evaluateRecipientPermissionScope', 'PAYER_ONLY_FINANCE_EXCLUDED',
  'BOOKER_PAYER_SCOPE_EXCEEDED', 'GUARDIAN_CARER_SCOPE_EXCEEDED',
  'SAFETY_SCOPE_EXCEEDED', 'BUSINESS_AUTHORITY_SCOPE_EXCEEDED',
  'DRIVER_MINIMUM_OPERATIONAL_SCOPE_EXCEEDED', 'ACTIVE_OPERATOR_TASK_REQUIRED',
  'decideCommunicationsClosureRoute', 'OPEN_COMMUNICATION_FAILURE_CASE',
  'acknowledgementRequired: boolean',
  'providerAcceptanceTreatedAsDelivery: false', 'staleFallbackAllowed: false',
  'decideCommunicationsDegradedMode', 'PAUSE_HIGH_RISK_CHANGE',
  'CONTINUE_ESSENTIAL_CANONICAL', 'communicationsAcceptanceScenarioMayPass',
  'nonSmartphonePathSucceeded', 'rideCheckMismatchBlockedJourneyStart',
  'breakdownPassengerContinuityPreserved', 'highRiskSecurityStepUpApplied',
  'accountRecoveredSolelyFromPhonePossession', 'criticalFallbackPrioritizedOverMarketing',
  'protectedContactRestrictedWithoutBlockingSafetySupport',
  'evaluateCommunicationsLaunchReadiness', 'providerExecutionMayBeEnabledAtThisCheckpoint: false',
  'COMMUNICATIONS_MAY_INVENT_BUSINESS_STATE = false',
  'ENDPOINT_CALL_GRANTS_DOMAIN_AUTHORITY = false',
  'UNMANAGED_PROVIDER_BYPASS_ALLOWED = false',
  'VOICE_AI_HIGH_RISK_DECISION_ALLOWED = false',
  'COMMUNICATIONS_PRODUCTION_EXECUTION_ENABLED = false',
  'COMMUNICATIONS_CLOSURE_MUTATIONS_ENABLED = false'
]) if (!domain.includes(boundary)) errors.push(`Missing Communications final-closure domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/communications-closure.ts'), 'utf8');
for (const projection of [
  'CommunicationsClosureCapabilitiesProjection', 'CommunicationsClosureStatusProjection',
  'CommunicationLaunchGateProjection', 'CommunicationsLaunchReadinessProjection',
  'priorityGrantsAdditionalDataAccess: false', 'providerAcceptanceTreatedAsDelivery: false',
  'criticalEventTypes', 'conceptualApiOperations', 'p0Requirements',
  'pilotReady: false', 'communicationsClosureMutationsEnabled: false',
  'conceptualCommandMutationsImplemented: false'
]) if (!contracts.includes(projection)) errors.push(`Missing final-closure contract truth: ${projection}`);

const service = readFileSync(join(root, 'services/api/src/modules/communications-closure/communications-closure-service.ts'), 'utf8');
for (const boundary of [
  'getCommunicationsClosureCapabilities', 'canonicalRequestContractModelled: true',
  'criticalEventTypes: CRITICAL_COMMUNICATION_EVENT_TYPES',
  'conceptualApiOperations: COMMUNICATION_CONCEPTUAL_API_OPERATIONS',
  'p0Requirements: COMMUNICATION_P0_REQUIREMENTS',
  'communicationsInventsBusinessState: false', 'endpointCallGrantsDomainAuthority: false',
  'getRecipientCommunicationsClosureStatus', 'WHERE request.recipient_person_id = $1',
  'recipientScoped: true', 'priorityGrantsAdditionalDataAccess: false',
  'getCommunicationsLaunchReadiness', "status: row?.status ?? 'NOT_TESTED'",
  'productionPoliciesApproved: false', 'providerSelectedAndContracted: false',
  'operationsStaffingApproved: false', 'privacyRetentionApproved: false',
  'pilotReady: false', 'providerExecutionMayBeEnabledAtThisCheckpoint: false'
]) if (!service.includes(boundary)) errors.push(`Missing final-closure service boundary: ${boundary}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Communications closure service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/communications-closure/routes.ts'), 'utf8');
for (const path of [
  '/v1/communications/closure/capabilities', '/v1/communications/closure/status',
  '/v1/communications/closure/readiness'
]) if (!routes.includes(path)) errors.push(`Communications closure API route missing: ${path}`);
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal']) {
  if (!routes.includes(gate)) errors.push(`Communications closure API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Communications closure routes expose an unapproved mutation');

const main = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const value of ['registerCommunicationsClosureRoutes', 'communicationsClosureExecution']) {
  if (!main.includes(value)) errors.push(`API bootstrap missing Phase 0.16 value: ${value}`);
}
const mainPhase = main.match(/checkpoint:\s*'engineering-phase-0\.(\d+)'/)?.[1];
if (!mainPhase || Number(mainPhase) < 16) errors.push('API bootstrap checkpoint predates Phase 0.16');
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const value of [
  "readonly communicationsClosureMode: 'disabled'",
  'COMMUNICATIONS_CLOSURE_MODE must remain disabled until every launch gate and accountable approval passes',
  "communicationsClosureMode: 'disabled'"
]) if (!config.includes(value)) errors.push(`API configuration missing final-closure disable boundary: ${value}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
if (!environment.includes('COMMUNICATIONS_CLOSURE_MODE=disabled')) errors.push('Environment missing disabled Phase 0.16 truth');

for (const rel of ['apps/rider/src/communications-operations-api.ts', 'apps/driver/src/communications-operations-api.ts']) {
  const client = readFileSync(join(root, rel), 'utf8');
  for (const truth of [
    'readCommunicationsClosureCapabilities', 'readCommunicationsClosureStatus',
    'readCommunicationsLaunchReadiness', 'Authorization: `Bearer'
  ]) if (!client.includes(truth)) errors.push(`${rel} missing final-closure client truth: ${truth}`);
}
for (const rel of ['apps/rider/App.tsx', 'apps/driver/App.tsx']) {
  const app = readFileSync(join(root, rel), 'utf8');
  for (const truth of [
    'ENGINEERING PHASE 0.16', 'Refresh communications closure truth',
    'PROVIDER BYPASS · CLOSURE COMMANDS · PILOT LAUNCH DISABLED',
    'priority expands access: NO', 'pilot ready: NO · provider execution: NO'
  ]) if (!app.includes(truth)) errors.push(`${rel} missing final-closure truth surface: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Final closure does not grant operational authority', 'Priority changes urgency and routing; it never grants broader access',
  'stale fallback is prohibited', 'Eighteen acceptance cases and thirteen launch gates are explicit',
  'Unmanaged provider calls, closure mutations, real-user scenarios and pilot launch remain disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room final-closure boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of [
  '/communications/closure/capabilities:', '/communications/closure/status:', '/communications/closure/readiness:'
]) if (!api.includes(path)) errors.push(`OpenAPI Phase 0.16 path missing: ${path}`);
for (const statement of [
  'Communications transports authoritative domain truth and never invents it',
  'Priority grants no additional data access', 'provider acceptance is not delivery',
  'stale and duplicate work is suppressed', 'thirteen gates and separate accountable approvals are required',
  'communicationsClosureMutationsEnabled', 'conceptualCommandMutationsImplemented',
  'COM-CORE-001', 'SilentAssistance.v1', 'POST /communications/security/restrict-channel'
]) if (!api.includes(statement)) errors.push(`OpenAPI final-closure truth statement missing: ${statement}`);
const apiVersion = api.match(/\n\s*version:\s*0\.0\.(\d+)/)?.[1];
if (!apiVersion || Number(apiVersion) < 16) errors.push('OpenAPI version predates Phase 0.16');

let currentVersion = null;
for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const patch = Number(String(parsed.version).split('.')[2]);
  if (!Number.isInteger(patch) || patch < 16) errors.push(`${rel} version predates Phase 0.16`);
  currentVersion ??= parsed.version;
  if (parsed.version !== currentVersion) errors.push(`${rel} is not aligned to the current checkpoint version`);
}
const contractsPackage = JSON.parse(readFileSync(join(root, 'packages/contracts/package.json'), 'utf8'));
if (contractsPackage.dependencies['@dazat/domain'] !== currentVersion) errors.push('Contracts domain dependency is not aligned to the current checkpoint');
const apiPackage = JSON.parse(readFileSync(join(root, 'services/api/package.json'), 'utf8'));
if (apiPackage.dependencies['@dazat/domain'] !== currentVersion || apiPackage.dependencies['@dazat/contracts'] !== currentVersion) {
  errors.push('API internal dependencies are not aligned to the current checkpoint');
}
for (const rel of ['apps/driver/package.json', 'apps/rider/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.dependencies['@dazat/contracts'] !== currentVersion) errors.push(`${rel} contract dependency is not aligned to the current checkpoint`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.16 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.16 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus canonical envelope/request, role permission, ordered routing, degraded mode, acceptance, launch-gate and disabled-execution boundaries.`);
