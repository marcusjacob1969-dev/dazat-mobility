import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0014_telephone_voice_handoff_foundation.sql',
  'packages/domain/src/telephony-voice.ts',
  'packages/contracts/src/telephony-voice.ts',
  'services/api/src/modules/telephony-voice/telephony-voice-service.ts',
  'services/api/src/modules/telephony-voice/routes.ts',
  'apps/rider/src/telephony-voice-api.ts',
  'apps/driver/src/telephony-voice-api.ts',
  'docs/architecture/ADR-0014-telephone-voice-human-handoff-truth.md',
  'docs/engineering/phase-0-14-checklist.md',
  'docs/traceability/phase-0-14-requirements.md',
  'tests/domain/telephony-voice-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.14 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'communications.call_session', 'communications.caller_identity_assessment',
  'communications.contact_plan_version', 'communications.voice_dialogue_session',
  'communications.voice_field_capture', 'communications.telephone_booking_session',
  'communications.call_transfer', 'communications.callback_request',
  'communications.secure_payment_handoff', 'communications.call_recording',
  'communications.call_transcript', 'communications.transcript_correction',
  'communications.interpreter_session', 'safety.safety_attention_signal',
  'communications.pending_telephone_interaction', 'communications.call_event',
  'communications.telephony_command_deduplication', 'communications.telephony_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.14 persistence object: ${object}`);
for (const guarantee of [
  'caller_id_treated_as_identity_proof boolean NOT NULL DEFAULT false',
  'disclosure_unrestricted boolean NOT NULL DEFAULT false',
  'diagnosis_stored boolean NOT NULL DEFAULT false',
  'backend_validation_bypassed boolean NOT NULL DEFAULT false',
  'transcript_treated_as_authority boolean NOT NULL DEFAULT false',
  'canonical_booking_engine_used boolean NOT NULL DEFAULT true',
  'separate_reduced_function_system_used boolean NOT NULL DEFAULT false',
  'raw_card_details_captured boolean NOT NULL DEFAULT false',
  'blind_repeat_collection_allowed boolean NOT NULL DEFAULT false',
  'caller_identity_authority_expanded_by_payment boolean NOT NULL DEFAULT false',
  'transcript_authoritative boolean NOT NULL DEFAULT false',
  'original_transcript_rewritten boolean NOT NULL DEFAULT false',
  'proves_danger_or_misconduct boolean NOT NULL DEFAULT false',
  'emergency_services_replaced boolean NOT NULL DEFAULT false',
  'duplicate_booking_creation_allowed boolean NOT NULL DEFAULT false',
  'provider_execution_enabled boolean NOT NULL DEFAULT false'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.14 SQL guarantee: ${guarantee}`);
for (const guard of [
  'communications.guard_call_session_update', 'Terminal CallSession cannot change',
  'communications.guard_contact_plan_version_update', 'ContactPlanVersion content is immutable',
  'communications.guard_voice_dialogue_update', 'Invalid VoiceDialogueSession transition',
  'communications.guard_telephone_booking_update', 'Confirmed critical fields cannot be removed',
  'caller_identity_assessment_immutable', 'voice_field_capture_immutable',
  'call_transfer_immutable', 'safety_attention_signal_immutable', 'call_event_immutable'
]) if (!sql.includes(guard)) errors.push(`Missing Phase 0.14 persistence guard: ${guard}`);

const domain = readFileSync(join(root, 'packages/domain/src/telephony-voice.ts'), 'utf8');
for (const boundary of [
  'assessCallerAuthority', 'CALLER_ID_HINT', 'HIGH_RISK_VOICE_PROHIBITED',
  'canTransitionVoiceDialogue', 'REQUIRED_FIELDS_COLLECTION', 'BACKEND_COMMAND',
  'evaluateVoiceFieldCapture', 'TARGETED_CLARIFICATION', 'EXPLICIT_READBACK',
  'telephoneBookingMayCommit', 'CANONICAL_BOOKING_ENGINE_REQUIRED',
  'humanHandoffDecision', 'SCHOOL_SAFEGUARDING', 'warmContextRequired',
  'telephonePaymentDecision', 'RECONCILIATION_REQUIRED', 'callResumeDecision',
  'recordingAndTranscriptMayBeUsed', 'TELEPHONY_PROVIDER_CONFIGURED = false',
  'CALLER_ID_ALONE_AUTHENTICATES = false', 'VOICE_RECOGNITION_IS_AUTHORITY = false',
  'VOICE_BIOMETRIC_SOLE_HIGH_RISK_AUTHORITY = false',
  'VOICE_ASSISTANT_MAY_OVERRIDE_BACKEND_RULES = false'
]) if (!domain.includes(boundary)) errors.push(`Missing telephone/voice domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/telephony-voice.ts'), 'utf8');
for (const projection of [
  'TelephonyServiceCapabilitiesProjection', 'ContactPlanProjection',
  'CallerIdentityAssessmentProjection', 'CallSessionSummaryProjection',
  'TelephonyInteractionListProjection', 'VoiceDialogueProjection',
  'telephoneProviderConfigured: false', 'callerIdTreatedAsIdentityProof: false',
  'personalNumberExposed: false', 'backendValidationBypassed: false'
]) if (!contracts.includes(projection)) errors.push(`Missing telephone/voice contract truth: ${projection}`);

const service = readFileSync(join(root, 'services/api/src/modules/telephony-voice/telephony-voice-service.ts'), 'utf8');
for (const boundary of [
  'getTelephonyServiceCapabilities', 'telephoneUsesCanonicalEngines: true',
  'telephoneProviderConfigured: false', 'voiceAssistantConfigured: false',
  'getContactPlan', "status = 'ACTIVE'", 'diagnosisStored: false',
  'listTelephonyInteractions', 'call.resolved_person_id = $1',
  'warm_handoff_context_present', 'pending_interaction_preserved', 'personalNumberExposed: false'
]) if (!service.includes(boundary)) errors.push(`Missing telephone/voice service boundary: ${boundary}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Telephone/voice service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/telephony-voice/routes.ts'), 'utf8');
for (const path of ['/v1/telephony/capabilities', '/v1/contact-plan', '/v1/telephony/interactions']) {
  if (!routes.includes(path)) errors.push(`Telephone/voice API route missing: ${path}`);
}
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal']) {
  if (!routes.includes(gate)) errors.push(`Telephone/voice API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Telephone/voice routes expose an unapproved mutation');

const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
for (const value of [
  'registerTelephonyVoiceRoutes', 'engineering-phase-0.14',
  'NOT_REQUIRED_FOR_PHASE_0_14_TELEPHONE_VOICE_FOUNDATION',
  'telephonyProvider', 'voiceAssistant'
]) if (!main.includes(value)) errors.push(`API bootstrap missing Phase 0.14 value: ${value}`);
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const value of [
  "readonly telephonyProviderMode: 'disabled'", "readonly voiceAssistantMode: 'disabled'",
  'TELEPHONY_PROVIDER_MODE must remain disabled', 'VOICE_ASSISTANT_MODE must remain disabled',
  "telephonyProviderMode: 'disabled'", "voiceAssistantMode: 'disabled'"
]) if (!config.includes(value)) errors.push(`API configuration missing telephone/voice disable boundary: ${value}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
for (const value of ['TELEPHONY_PROVIDER_MODE=disabled', 'VOICE_ASSISTANT_MODE=disabled']) {
  if (!environment.includes(value)) errors.push(`Environment missing provider-disabled truth: ${value}`);
}

for (const rel of ['apps/rider/src/telephony-voice-api.ts', 'apps/driver/src/telephony-voice-api.ts']) {
  const client = readFileSync(join(root, rel), 'utf8');
  for (const truth of ['readTelephonyCapabilities', 'readContactPlan', 'readTelephonyInteractions', 'Authorization: `Bearer']) {
    if (!client.includes(truth)) errors.push(`${rel} missing telephone/voice client truth: ${truth}`);
  }
}
for (const rel of ['apps/rider/App.tsx', 'apps/driver/App.tsx']) {
  const app = readFileSync(join(root, rel), 'utf8');
  for (const truth of [
    'ENGINEERING PHASE 0.14', 'Caller ID never proves identity',
    'Refresh telephone and Contact Plan truth',
    'TELEPHONY · VOICE ASSISTANT · RECORDING · TRANSCRIPTION PROVIDERS DISABLED'
  ]) if (!app.includes(truth)) errors.push(`${rel} missing telephone/voice truth surface: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Telephone is a channel, not a second transport system', 'Caller ID is only a routing hint',
  'require structured capture, readback and confirmation', 'require warm human handoff',
  'voice biometrics are not enabled', 'providers remain disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room telephone/voice boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/telephony/capabilities:', '/contact-plan:', '/telephony/interactions:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.14 path missing: ${path}`);
}
for (const statement of [
  'Caller ID is not authentication', 'confirmed structured fields outrank transcripts',
  'no external telephony or Voice Assistant execution is enabled',
  'personal numbers are never exposed'
]) if (!api.includes(statement)) errors.push(`OpenAPI telephone/voice truth statement missing: ${statement}`);
if (!api.includes('version: 0.0.14')) errors.push('OpenAPI is not versioned at 0.0.14');

let currentVersion = null;
for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.version !== '0.0.14') errors.push(`${rel} is not versioned at 0.0.14`);
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
  console.error('DAZAT Engineering Phase 0.14 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.14 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus caller-identity, confirmed-dialogue, canonical Booking, payment, handoff, recording, dropped-call, provider-disabled and recipient-scope boundaries.`);
