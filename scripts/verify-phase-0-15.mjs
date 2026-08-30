import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0015_omnichannel_contact_centre_observability_foundation.sql',
  'packages/domain/src/communications-operations.ts',
  'packages/contracts/src/communications-operations.ts',
  'services/api/src/modules/communications-operations/communications-operations-service.ts',
  'services/api/src/modules/communications-operations/routes.ts',
  'apps/rider/src/communications-operations-api.ts',
  'apps/driver/src/communications-operations-api.ts',
  'docs/architecture/ADR-0015-omnichannel-contact-centre-observability-truth.md',
  'docs/engineering/phase-0-15-checklist.md',
  'docs/traceability/phase-0-15-requirements.md',
  'tests/domain/communications-operations-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.15 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'communications.notification_policy_version', 'communications.delivery_policy_version',
  'communications.communication_request', 'communications.communication_policy_resolution',
  'communications.contact_case', 'communications.contact_case_interaction',
  'communications.contact_case_transfer', 'communications.communication_failure_case',
  'communications.critical_acknowledgement_requirement', 'communications.communication_slo_version',
  'communications.communication_slo_observation', 'communications.channel_provider_profile',
  'communications.channel_provider_health_observation', 'communications.provider_outage_response_plan_version',
  'communications.communications_scenario', 'communications.communications_scenario_run',
  'communications.communications_scenario_result', 'communications.communications_operations_event',
  'communications.communications_operations_command_deduplication',
  'communications.communications_operations_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.15 persistence object: ${object}`);
for (const guarantee of [
  'marketing_separated_from_operational boolean NOT NULL DEFAULT true',
  'current_state_revalidation_required boolean NOT NULL DEFAULT true',
  'repeated_same_channel_hammering_allowed boolean NOT NULL DEFAULT false',
  'business_state_invented_by_communications boolean NOT NULL DEFAULT false',
  'marketing_relabelled_as_operational boolean NOT NULL DEFAULT false',
  'silent_assistance_do_not_call_preserved boolean NOT NULL DEFAULT true',
  'replaces_canonical_domain_case boolean NOT NULL DEFAULT false',
  'personal_email_or_sms_workaround_used boolean NOT NULL DEFAULT false',
  'channel_history_preserved boolean NOT NULL DEFAULT true',
  'long_term_personal_rating_created boolean NOT NULL DEFAULT false',
  'provider_acceptance_treated_as_delivery boolean NOT NULL DEFAULT false',
  'sensitive_message_content_included boolean NOT NULL DEFAULT false',
  'provider_configured boolean NOT NULL DEFAULT false',
  'provider_execution_enabled boolean NOT NULL DEFAULT false',
  'stale_replay_allowed boolean NOT NULL DEFAULT false',
  'duplicate_replay_allowed boolean NOT NULL DEFAULT false',
  'real_user_contact_allowed boolean NOT NULL DEFAULT false',
  'contacted_real_users boolean NOT NULL DEFAULT false',
  'external_provider_execution_enabled boolean NOT NULL DEFAULT false'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.15 SQL guarantee: ${guarantee}`);
for (const guard of [
  'communications.guard_notification_policy_version_update', 'NotificationPolicyVersion content is immutable',
  'communications.guard_version_close_update', 'communications.guard_communication_request_update',
  'Terminal CommunicationRequest cannot change', 'communication_policy_resolution_immutable',
  'communications.guard_contact_case_update', 'High-risk ContactCase cannot remain unowned',
  'contact_case_interaction_immutable', 'contact_case_transfer_immutable',
  'communications.guard_communication_failure_case_update', 'Critical communication failure cannot remain unowned',
  'communications.guard_critical_acknowledgement_update', 'communication_slo_observation_immutable',
  'channel_provider_profile_immutable', 'channel_provider_health_observation_immutable',
  'communications.guard_scenario_run_update',
  'communications_operations_event_immutable'
]) if (!sql.includes(guard)) errors.push(`Missing Phase 0.15 persistence guard: ${guard}`);

const domain = readFileSync(join(root, 'packages/domain/src/communications-operations.ts'), 'utf8');
for (const boundary of [
  'evaluateNotificationPolicy', 'AUTHORITATIVE_DOMAIN_EVENT_REQUIRED', 'RECIPIENT_ROLE_NOT_ELIGIBLE',
  'STALE_SOURCE_VERSION_SUPPRESSED', 'MARKETING_OPERATIONAL_RELABEL_PROHIBITED',
  'STATUS_UNKNOWN_RETRY_WORDING_PROHIBITED', 'BREAKDOWN_CONTINUITY_MUST_PRESERVE_BOOKING',
  'SAFEGUARDING_CONSUMER_WORDING_PROHIBITED', 'deliveryAssuranceDecision',
  'OPEN_COMMUNICATION_FAILURE_CASE', 'repeatedChannelHammeringAllowed: false',
  'evaluateContactCaseOwnership', 'HIGH_RISK_CASE_OWNER_REQUIRED', 'RECEIVING_OWNER_REQUIRED_BEFORE_TRANSFER',
  'providerOutageRoutingDecision', 'DISCARD_STALE', 'observabilityMetricMayBeRecorded',
  'communicationsScenarioMayPass', 'CONTACT_CASE_MAY_REPLACE_CANONICAL_DOMAIN_CASE = false',
  'CONTACTABILITY_MAY_BECOME_LONG_TERM_PERSONAL_RATING = false',
  'PROVIDER_ACCEPTANCE_PROVES_DELIVERY = false', 'RECOVERY_MAY_RELEASE_STALE_MESSAGES_BLINDLY = false',
  'COMMUNICATIONS_OPERATIONS_PROVIDER_EXECUTION_ENABLED = false',
  'CONTACT_CENTRE_STAFF_MUTATION_ENABLED = false'
]) if (!domain.includes(boundary)) errors.push(`Missing communications operations domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/communications-operations.ts'), 'utf8');
for (const projection of [
  'CommunicationsOperationsCapabilitiesProjection', 'NotificationPolicySummaryProjection',
  'ContactCaseSummaryProjection', 'ContactCaseListProjection',
  'ChannelProviderHealthProjection', 'CommunicationsOperationsStatusProjection',
  'externalProviderExecutionEnabled: false', 'contactCentreStaffMutationEnabled: false',
  'replacesCanonicalDomainCase: false', 'providerAcceptanceTreatedAsDelivery: false'
]) if (!contracts.includes(projection)) errors.push(`Missing communications operations contract truth: ${projection}`);

const service = readFileSync(join(root, 'services/api/src/modules/communications-operations/communications-operations-service.ts'), 'utf8');
for (const boundary of [
  'getCommunicationsOperationsCapabilities', 'notificationPolicyCatalogueModelled: true',
  'externalProviderExecutionEnabled: false', 'contactCentreStaffMutationEnabled: false',
  'listRecipientContactCases', 'WHERE person_id = $1', 'channelHistoryPreserved: true',
  'replacesCanonicalDomainCase: false', 'getRecipientCommunicationsOperationsStatus',
  'communication.recipient_person_id = $1', 'providerAcceptanceTreatedAsDelivery: false',
  'aggregateMetricsExcludeSensitiveContent: true', 'recoveryRevalidatesCurrentState: true'
]) if (!service.includes(boundary)) errors.push(`Missing communications operations service boundary: ${boundary}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Communications operations service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/communications-operations/routes.ts'), 'utf8');
for (const path of [
  '/v1/communications/operations/capabilities', '/v1/contact-centre/cases',
  '/v1/communications/operations/status'
]) if (!routes.includes(path)) errors.push(`Communications operations API route missing: ${path}`);
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal']) {
  if (!routes.includes(gate)) errors.push(`Communications operations API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Communications operations routes expose an unapproved mutation');

const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
for (const value of [
  'registerCommunicationsOperationsRoutes',
  'contactCentreMutation', 'communicationsScenarioExecution'
]) if (!main.includes(value)) errors.push(`API bootstrap missing Phase 0.15 value: ${value}`);
const mainPhase = main.match(/checkpoint:\s*'engineering-phase-0\.(\d+)'/)?.[1];
if (!mainPhase || Number(mainPhase) < 15) errors.push('API bootstrap checkpoint predates Phase 0.15');
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const value of [
  "readonly contactCentreMutationMode: 'disabled'", "readonly communicationsScenarioMode: 'disabled'",
  'CONTACT_CENTRE_MUTATION_MODE must remain disabled', 'COMMUNICATIONS_SCENARIO_MODE must remain disabled',
  "contactCentreMutationMode: 'disabled'", "communicationsScenarioMode: 'disabled'"
]) if (!config.includes(value)) errors.push(`API configuration missing communications operations disable boundary: ${value}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
for (const value of ['CONTACT_CENTRE_MUTATION_MODE=disabled', 'COMMUNICATIONS_SCENARIO_MODE=disabled']) {
  if (!environment.includes(value)) errors.push(`Environment missing disabled Phase 0.15 truth: ${value}`);
}

for (const rel of ['apps/rider/src/communications-operations-api.ts', 'apps/driver/src/communications-operations-api.ts']) {
  const client = readFileSync(join(root, rel), 'utf8');
  for (const truth of [
    'readCommunicationsOperationsCapabilities', 'readContactCases',
    'readCommunicationsOperationsStatus', 'Authorization: `Bearer'
  ]) if (!client.includes(truth)) errors.push(`${rel} missing communications operations client truth: ${truth}`);
}
for (const rel of ['apps/rider/App.tsx', 'apps/driver/App.tsx']) {
  const app = readFileSync(join(root, rel), 'utf8');
  for (const truth of [
    'Refresh communications operations truth',
    'PROVIDERS · CONTACT CENTRE MUTATIONS · REAL-USER SCENARIOS DISABLED',
    'provider execution: NO · staff mutation: NO'
  ]) if (!app.includes(truth)) errors.push(`${rel} missing communications operations truth surface: ${truth}`);
  const phase = app.match(/ENGINEERING PHASE 0\.(\d+)/)?.[1];
  if (!phase || Number(phase) < 15) errors.push(`${rel} checkpoint predates Phase 0.15`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Critical delivery failure is owned operational work', 'versioned Notification Policy',
  'P0/P1 work cannot remain unowned', 'personal email or SMS tools are never an acceptable workaround',
  'Provider acceptance is not delivery', 'metrics exclude sensitive content',
  'Providers, staff mutations and real-user scenario execution remain disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room communications operations boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/communications/operations/capabilities:', '/contact-centre/cases:', '/communications/operations/status:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.15 path missing: ${path}`);
}
for (const statement of [
  'Notification/Delivery Policy', 'Cases preserve priority',
  'provider acceptance is not delivery', 'RECOVERING revalidates current state',
  'metrics exclude sensitive content', 'no provider, staff mutation or real-user scenario execution is enabled'
]) if (!api.includes(statement)) errors.push(`OpenAPI communications operations truth statement missing: ${statement}`);
const apiVersion = api.match(/\n\s*version:\s*0\.0\.(\d+)/)?.[1];
if (!apiVersion || Number(apiVersion) < 15) errors.push('OpenAPI version predates Phase 0.15');

let currentVersion = null;
for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const patch = Number(String(parsed.version).split('.')[2]);
  if (!Number.isInteger(patch) || patch < 15) errors.push(`${rel} version predates Phase 0.15`);
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
  console.error('DAZAT Engineering Phase 0.15 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.15 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus policy, role, stale, delivery, acknowledgement, case, ownership, outage, recovery, SLO, privacy, scenario and disabled-execution boundaries.`);
