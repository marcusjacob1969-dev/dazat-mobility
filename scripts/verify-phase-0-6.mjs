import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0006_live_journey_monitoring_completion_foundation.sql',
  'packages/domain/src/live-journey.ts',
  'packages/contracts/src/live-journey.ts',
  'services/api/src/modules/journey/live-journey-service.ts',
  'services/api/src/modules/safety/safety-service.ts',
  'services/api/src/modules/safety/routes.ts',
  'apps/driver/src/journey-api.ts',
  'apps/rider/src/journey-api.ts',
  'docs/architecture/ADR-0006-live-journey-safety-governed-completion.md',
  'docs/engineering/phase-0-6-checklist.md',
  'docs/traceability/phase-0-6-requirements.md',
  'tests/domain/live-journey-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.6 file: ${rel}`);

const migrationPath = join(root, required[0]);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
for (const object of [
  'journey.journey_event', 'journey.route_deviation_signal', 'journey.route_change_request',
  'journey.destination_approach_evidence', 'journey.completion_requirement_snapshot',
  'journey.handover_record', 'journey.continuity_case', 'journey.completion_evidence', 'safety.command_deduplication',
  'safety.outbox_message', 'journey.control_room_projection'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.6 persistence object: ${object}`);
for (const guarantee of [
  'misconduct_finding boolean NOT NULL DEFAULT false CHECK (misconduct_finding = false)',
  'do_not_auto_call_reporter boolean NOT NULL DEFAULT false',
  "security_classification IN ('RESTRICTED','HIGHLY_RESTRICTED')",
  'BEFORE UPDATE OR DELETE ON journey.journey_event',
  'BEFORE UPDATE OR DELETE ON journey.route_deviation_signal'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.6 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/live-journey.ts'), 'utf8');
for (const guard of [
  'evaluateMovementPlausibility', 'evaluateDestinationEvidence', 'evaluateJourneyCompletion',
  'silentAssistancePolicy', 'routeConcernSeverity', 'ROUTE_CONCERN_IS_AUTOMATIC_MISCONDUCT_FINDING = false'
]) if (!domain.includes(guard)) errors.push(`Missing live Journey domain guard: ${guard}`);

const journey = readFileSync(join(root, 'services/api/src/modules/journey/live-journey-service.ts'), 'utf8');
for (const guard of [
  "purpose = 'ACTIVE_JOURNEY'", 'PENDING_POLICY_REVIEW', 'routeChanged: false',
  'ACTIVE_JOURNEY_LOCATION_MISSING', 'GOVERNED_COMPLETION_VALIDATED', "journey.continuity_case WHERE journey_id = $1 AND status = 'OPEN'",
  'canReleaseDriverAfterJourneyCompletion', 'paymentInitiated: false',
  "reconnectInstruction: 'AUTHORITATIVE_SNAPSHOT'"
]) if (!journey.includes(guard)) errors.push(`Missing live Journey transactional guard: ${guard}`);

const safety = readFileSync(join(root, 'services/api/src/modules/safety/safety-service.ts'), 'utf8');
for (const guard of [
  'doNotAutoCallReporter', 'externalDeliveryRequiredForPersistence: false',
  'misconductFindingCreated: false', "'HIGHLY_RESTRICTED'", 'safety.command_deduplication',
  'safety.outbox_message', 'persistedBeforeExternalDelivery: true'
]) if (!safety.includes(guard)) errors.push(`Missing Safety transactional/privacy guard: ${guard}`);
if (/fetch\(|axios|twilio|provider\.send/i.test(safety)) errors.push('Safety persistence path has an external delivery dependency');

const routes = readFileSync(join(root, 'services/api/src/modules/journey/routes.ts'), 'utf8');
for (const path of ['/telemetry/location', '/stop-requests', '/route-change-requests', '/arriving', '/complete', '/active']) {
  if (!routes.includes(path)) errors.push(`Live Journey API route missing: ${path}`);
}
const safetyRoutes = readFileSync(join(root, 'services/api/src/modules/safety/routes.ts'), 'utf8');
for (const path of ['/safety/signals/sos', '/safety/signals/silent-assistance', '/safety/route-concerns']) {
  if (!safetyRoutes.includes(path)) errors.push(`Safety API route missing: ${path}`);
}

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const action of ['sendActiveJourneyLocation', 'sendDriverSos', 'markDestinationArriving', 'completeActiveJourney']) {
  if (!driver.includes(action)) errors.push(`Driver active Journey is not wired to ${action}`);
}
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
for (const action of ['requestJourneyStop', "signalSafety('SOS')", "signalSafety('SILENT_ASSISTANCE')", 'automatic misconduct finding']) {
  if (!rider.includes(action)) errors.push(`Rider active Journey boundary missing: ${action}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const expectation of ['NORMAL, ATTENTION, AT_RISK or INCIDENT', 'never an automatic misconduct finding', 'authorised handover', 'Payment is not initiated']) {
  if (!controlRoom.includes(expectation)) errors.push(`Control Room Phase 0.6 expectation missing: ${expectation}`);
}

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/telemetry/location:', '/stop-requests:', '/arriving:', '/complete:', '/safety/signals/sos:', '/safety/signals/silent-assistance:', '/safety/route-concerns:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.6 path missing: ${path}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.6 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.6 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus telemetry, Safety, governed change, handover and completion boundaries.`);
