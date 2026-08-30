import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0013_unified_communications_core_foundation.sql',
  'packages/domain/src/communications.ts',
  'packages/contracts/src/communications.ts',
  'services/api/src/modules/communications/communications-service.ts',
  'services/api/src/modules/communications/routes.ts',
  'apps/rider/src/communications-api.ts',
  'apps/driver/src/communications-api.ts',
  'docs/architecture/ADR-0013-unified-communications-core-truth.md',
  'docs/engineering/phase-0-13-checklist.md',
  'docs/traceability/phase-0-13-requirements.md',
  'tests/domain/communications-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.13 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'communications.communication_template_version',
  'communications.communication_preference_version',
  'communications.communication',
  'communications.communication_status_event',
  'communications.communication_delivery_plan',
  'communications.message_delivery',
  'communications.communication_acknowledgement',
  'communications.protected_conversation',
  'communications.masked_call_session',
  'communications.channel_health_observation',
  'communications.current_channel_health',
  'communications.communication_command_deduplication',
  'communications.communication_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.13 persistence object: ${object}`);
for (const guarantee of [
  'asks_for_password boolean NOT NULL DEFAULT false CHECK (asks_for_password = false)',
  'asks_for_full_pin boolean NOT NULL DEFAULT false CHECK (asks_for_full_pin = false)',
  'asks_for_otp boolean NOT NULL DEFAULT false CHECK (asks_for_otp = false)',
  'asks_for_device_linking_code boolean NOT NULL DEFAULT false CHECK (asks_for_device_linking_code = false)',
  'marketing_relabelled_as_operational boolean NOT NULL DEFAULT false',
  'personal_contact_details_exposed boolean NOT NULL DEFAULT false',
  'external_provider_execution_enabled boolean NOT NULL DEFAULT false',
  'provider_execution_authorised boolean NOT NULL DEFAULT false',
  'compromised_channels_excluded boolean NOT NULL DEFAULT true',
  "'QUEUED','SENT','DELIVERED','READ','FAILED','EXPIRED','UNKNOWN','SUPPRESSED_STALE'",
  "state <> 'SUPPRESSED_STALE' OR source_version_revalidated",
  'personal_numbers_disclosed boolean NOT NULL DEFAULT false'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.13 SQL guarantee: ${guarantee}`);
for (const transitionGuard of [
  'communications.guard_preference_version_update',
  'CommunicationPreferenceVersion may only be closed once',
  'communications.guard_communication_update',
  "OLD.status = 'ACK_REQUIRED' AND NEW.status IN ('ACKNOWLEDGED','EXPIRED','FAILED')",
  'communication_delete_guard'
]) if (!sql.includes(transitionGuard)) errors.push(`Missing Phase 0.13 transition guard: ${transitionGuard}`);

const domain = readFileSync(join(root, 'packages/domain/src/communications.ts'), 'utf8');
for (const guard of [
  'planCommunicationRoute', 'SUPPRESSED_NO_CONSENT', 'DEFERRED_QUIET_HOURS',
  'assessCommunicationCurrency', 'SOURCE_VERSION_STALE', 'acknowledgementAction',
  'HUMAN_ESCALATION_REQUIRED', 'protectedContactWindowIsActive', 'securityTemplateIsSafe',
  'MARKETING_MAY_BE_RELABELED_OPERATIONAL = false', 'CALLER_ID_PROVES_IDENTITY = false',
  'PERSONAL_CONTACT_DETAILS_EXPOSED_BY_PROTECTED_CONTACT = false',
  'EXTERNAL_COMMUNICATION_PROVIDER_CONFIGURED = false'
]) if (!domain.includes(guard)) errors.push(`Missing Communications domain guard: ${guard}`);

const service = readFileSync(join(root, 'services/api/src/modules/communications/communications-service.ts'), 'utf8');
for (const guard of [
  'listCommunications', 'getCommunication', 'acknowledgeCommunication', 'requestInternalCommunication',
  'current_channel_health', 'communication_acknowledgement', 'communication_delivery_plan',
  'assessCommunicationCurrency', 'currency.suppressionReason', 'planCommunicationRoute',
  'repeatedAcknowledgement', 'externalProviderExecutionEnabled: false',
  "row.status !== 'ACK_REQUIRED'",
  "'communications.communication-suppressed'", "'communications.acknowledgement-recorded'"
]) if (!service.includes(guard)) errors.push(`Missing Communications service boundary: ${guard}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Communications service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/communications/routes.ts'), 'utf8');
for (const path of [
  '/v1/communications', '/v1/communications/:communicationId',
  '/v1/communications/:communicationId/acknowledgements'
]) if (!routes.includes(path)) errors.push(`Communications API route missing: ${path}`);
for (const gate of ["'VIEW_PROFILE'", 'IDEMPOTENCY_KEY_REQUIRED', 'row.recipient_person_id !== actor.personId']) {
  if (!routes.includes(gate) && !service.includes(gate)) errors.push(`Communications API gate missing: ${gate}`);
}

const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
for (const value of ['registerCommunicationRoutes', 'engineering-phase-0.13', 'NOT_REQUIRED_FOR_PHASE_0_13_COMMUNICATIONS_CORE_FOUNDATION', 'communicationProvider']) {
  if (!main.includes(value)) errors.push(`API bootstrap missing Phase 0.13 value: ${value}`);
}
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const value of [
  "readonly communicationProviderMode: 'disabled'",
  'COMMUNICATION_PROVIDER_MODE must remain disabled',
  "communicationProviderMode: 'disabled'"
]) if (!config.includes(value)) errors.push(`API configuration missing provider-disable boundary: ${value}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
if (!environment.includes('COMMUNICATION_PROVIDER_MODE=disabled')) errors.push('Environment does not keep communication providers disabled');

for (const rel of ['apps/rider/src/communications-api.ts', 'apps/driver/src/communications-api.ts']) {
  const client = readFileSync(join(root, rel), 'utf8');
  for (const truth of ['readCommunicationInbox', 'readCommunication', 'acknowledgeCommunication', 'Idempotency-Key']) {
    if (!client.includes(truth)) errors.push(`${rel} missing communication client truth: ${truth}`);
  }
}
for (const rel of ['apps/rider/App.tsx', 'apps/driver/App.tsx']) {
  const app = readFileSync(join(root, rel), 'utf8');
  for (const truth of [
    'ENGINEERING PHASE 0.13', 'Communication inbox — intent is not delivery',
    'UNKNOWN never means delivered', 'EXTERNAL PUSH · SMS · EMAIL · TELEPHONY · CHAT PROVIDERS DISABLED'
  ]) if (!app.includes(truth)) errors.push(`${rel} missing Communications truth surface: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Communication intent is not delivery truth', 'Marketing consent is separate',
  'UNKNOWN remain distinct', 'Protected conversation and masked calling never expose personal contact details',
  'providers remain disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room communications boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/communications:', '/communications/{communicationId}:', '/communications/{communicationId}/acknowledgements:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.13 path missing: ${path}`);
}
for (const statement of [
  'Communication intent is separate from delivery', 'UNKNOWN is not delivery',
  'Personal contact details are never exposed', 'no external provider execution is enabled'
]) if (!api.includes(statement)) errors.push(`OpenAPI Communications truth statement missing: ${statement}`);
if (!api.includes('version: 0.0.13')) errors.push('OpenAPI is not versioned at 0.0.13');

for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.version !== '0.0.13') errors.push(`${rel} is not versioned at 0.0.13`);
}
const contractsPackage = JSON.parse(readFileSync(join(root, 'packages/contracts/package.json'), 'utf8'));
if (contractsPackage.dependencies['@dazat/domain'] !== '0.0.13') errors.push('Contracts domain dependency is not aligned to Phase 0.13');
const apiPackage = JSON.parse(readFileSync(join(root, 'services/api/package.json'), 'utf8'));
if (apiPackage.dependencies['@dazat/domain'] !== '0.0.13' || apiPackage.dependencies['@dazat/contracts'] !== '0.0.13') {
  errors.push('API internal dependencies are not aligned to Phase 0.13');
}
for (const rel of ['apps/driver/package.json', 'apps/rider/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.dependencies['@dazat/contracts'] !== '0.0.13') errors.push(`${rel} contract dependency is not aligned to Phase 0.13`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.13 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.13 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus purpose, recipient, template, stale, delivery, acknowledgement, protected-contact, provider-health and provider-disabled boundaries.`);
