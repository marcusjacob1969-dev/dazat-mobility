import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0012_driver_daily_operations_supply_support_foundation.sql',
  'packages/domain/src/driver-daily-operations.ts',
  'packages/contracts/src/driver-daily-operations.ts',
  'services/api/src/modules/driver-daily-operations/driver-daily-operations-service.ts',
  'services/api/src/modules/driver-daily-operations/routes.ts',
  'apps/driver/src/driver-daily-operations-api.ts',
  'docs/architecture/ADR-0012-driver-daily-operations-supply-support-truth.md',
  'docs/engineering/phase-0-12-checklist.md',
  'docs/traceability/phase-0-12-requirements.md',
  'tests/domain/driver-daily-operations-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.12 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = existsSync(join(root, required[0])) ? readFileSync(join(root, required[0]), 'utf8') : '';
for (const object of [
  'driver.driver_shift_session', 'driver.driver_shift_event',
  'driver.scheduled_work_commitment', 'driver.scheduled_work_commitment_event',
  'driver.homeward_preference_version', 'dispatch.driver_offer_disclosure',
  'driver.connectivity_reconciliation', 'communications.arrival_communication_plan_version',
  'operations.driver_support_case', 'operations.driver_support_case_event',
  'operations.supply_demand_observation', 'driver.daily_operations_command_deduplication',
  'driver.daily_operations_outbox_message', 'driver.current_daily_operations_projection',
  'operations.current_supply_demand_projection'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.12 persistence object: ${object}`);

for (const guarantee of [
  "location_source = 'FLEET_TELEMATICS'",
  'ordinary_offline_app_location_collection_allowed boolean NOT NULL DEFAULT false',
  "'SHIFT_STARTED','WORK_INTENT_CHANGED','OFFER_ACCEPTED','JOURNEY_COMPLETED_AVAILABLE'",
  'hard_eligibility_bypass_allowed boolean NOT NULL DEFAULT false',
  'passenger_attribute_use_allowed boolean NOT NULL DEFAULT false',
  'guaranteed_trip_claim_allowed boolean NOT NULL DEFAULT false',
  'expected_earning_derived_from_rider_fare boolean NOT NULL DEFAULT false',
  'blind_offer_prohibited boolean NOT NULL DEFAULT true',
  'ordinary_decline_penalty_applied boolean NOT NULL DEFAULT false',
  'acceptance_allowed = informed_choice_ready',
  'speculative_state_may_be_trusted boolean NOT NULL DEFAULT false',
  'queued_critical_events_executed boolean NOT NULL DEFAULT false',
  'passenger_gps_assumed_as_pickup boolean NOT NULL DEFAULT false',
  'direct_contact_details_exposed boolean NOT NULL DEFAULT false',
  'communication_execution_enabled boolean NOT NULL DEFAULT false',
  "(human_escalation_required AND status IN ('HUMAN_ESCALATION_REQUIRED','IN_PROGRESS','RESOLVED','CLOSED'))",
  'external_service_contacted boolean NOT NULL DEFAULT false',
  'guaranteed_earnings boolean NOT NULL DEFAULT false'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.12 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/driver-daily-operations.ts'), 'utf8');
for (const guard of [
  'DRIVER_DAILY_LIFECYCLE', 'evaluateDriverOfferDisclosure', 'INDEPENDENT_DRIVER_EARNING_BASIS',
  'assessDriverConnectivity', 'queuedCriticalEventsExecutedByReconciliation: false',
  'queuedCriticalEventSubmissionRoute', 'evaluateDriverSupportRouting',
  'supplySignalMayBePublished', 'homewardPreferenceMayInfluenceRanking',
  'arrivalCommunicationPlanIsSafe', 'BLIND_DRIVER_OFFERS_PERMITTED = false',
  'ORDINARY_OFFLINE_APP_LOCATION_COLLECTION_PERMITTED = false',
  'DEMAND_FORECAST_GUARANTEES_EARNINGS = false', 'VOICE_INPUT_BYPASSES_BACKEND_VALIDATION = false',
  'DRIVER_BREAK_IS_MISCONDUCT = false', 'DRIVER_FINISHING_SOON_IS_MISCONDUCT = false'
]) if (!domain.includes(guard)) errors.push(`Missing Driver daily-operations domain guard: ${guard}`);

const service = readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/driver-daily-operations-service.ts'), 'utf8');
for (const guard of [
  'current_daily_operations_projection', 'scheduled_work_commitment', 'connectivity_reconciliation',
  'active_journey_version', 'Connectivity observation cannot be in the future',
  'assessDriverConnectivity', 'queuedCriticalEventSubmissionRoute', 'queuedCriticalEventsExecuted: false',
  'assertSupportContextOwned', 'evaluateDriverSupportRouting', "'driver.support-case-opened'",
  'current_supply_demand_projection', 'guaranteedEarnings: false',
  'arrival_communication_plan_version', 'passengerGpsAssumedAsPickup: false',
  'directContactDetailsExposed: false', 'communicationExecutionEnabled: false'
]) if (!service.includes(guard)) errors.push(`Missing Driver daily-operations service guard: ${guard}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Driver daily-operations service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/routes.ts'), 'utf8');
for (const path of [
  '/v1/driver/daily-operations', '/v1/driver/connectivity/reconciliations',
  '/v1/driver/support-cases', '/v1/driver/supply-demand',
  '/v1/driver/bookings/:bookingId/arrival-plan'
]) if (!routes.includes(path)) errors.push(`Driver daily-operations API route missing: ${path}`);
for (const gate of ["'VIEW_PROFILE'", "'SUPPORT'", "'ACTIVE_JOURNEY'", 'IDEMPOTENCY_KEY_REQUIRED']) {
  if (!routes.includes(gate)) errors.push(`Driver daily-operations API gate missing: ${gate}`);
}

const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
for (const guard of [
  'recordDriverShiftAvailabilityEvent', "shiftStarted ? 'SHIFT_STARTED'", 'scheduled_work_commitment',
  'commitment.booking_id <> $6::uuid', 'evaluateDriverOfferDisclosure', 'driver_offer_disclosure',
  "'UNAVAILABLE_ROUTE_ESTIMATE_NOT_CONFIGURED'", "'UNAVAILABLE_FINANCE_POLICY_NOT_APPROVED'",
  'offer.acceptance_allowed !== true', 'informed-choice disclosures are complete',
  'booking.scheduledFor ?? new Date(), booking.bookingId', "desired === 'BREAK' || desired === 'OFFLINE'"
]) if (!dispatch.includes(guard)) errors.push(`Dispatch daily-operations boundary missing: ${guard}`);

const journey = readFileSync(join(root, 'services/api/src/modules/journey/live-journey-service.ts'), 'utf8');
if (!journey.includes("'JOURNEY_COMPLETED_AVAILABLE'")) errors.push('Journey completion does not append daily shift evidence');
const fairTreatment = readFileSync(join(root, 'services/api/src/modules/driver-fair-treatment/driver-fair-treatment-service.ts'), 'utf8');
if (!fairTreatment.includes("'UNSAFE_TERMINATION_BREAK'")) errors.push('Unsafe Journey termination does not append protected BREAK shift evidence');

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const truth of [
  'complete Driver day', 'BREAK and FINISHING_SOON are normal work states',
  'Reconcile after weak signal', 'Capability-based supply — never guaranteed earnings',
  'Driver Support', 'Provisional straight-line pickup distance:', 'Expected earning:',
  'not available until Finance-approved Driver earning policy exists',
  'Chosen Booking pickup — not assumed passenger GPS',
  'Voice readout, CarPlay and Android Auto remain unconfigured roadmaps'
]) if (!driver.includes(truth)) errors.push(`Driver daily-operations truth label missing: ${truth}`);

const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Blind offers fail closed', 'Weak-signal reconciliation replaces speculative client state',
  'Current demand and forecast are labelled separately', 'High-risk active cases require human escalation'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room daily-operations boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of [
  '/driver/daily-operations:', '/driver/connectivity/reconciliations:',
  '/driver/support-cases:', '/driver/supply-demand:', '/driver/bookings/{bookingId}/arrival-plan:'
]) if (!api.includes(path)) errors.push(`OpenAPI Phase 0.12 path missing: ${path}`);
for (const statement of [
  'OFFLINE stops ordinary app location collection', 'never pretends queued SOS',
  'contacts no external provider or emergency service automatically', 'No signal guarantees earnings',
  'passenger GPS is never assumed', 'communication execution is disabled'
]) if (!api.includes(statement)) errors.push(`OpenAPI daily-operations truth statement missing: ${statement}`);
if (!api.includes('version: 0.0.12')) errors.push('OpenAPI is not versioned at 0.0.12');

for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.version !== '0.0.12') errors.push(`${rel} is not versioned at 0.0.12`);
}
const apiPackage = JSON.parse(readFileSync(join(root, 'services/api/package.json'), 'utf8'));
if (apiPackage.dependencies['@dazat/domain'] !== '0.0.12' || apiPackage.dependencies['@dazat/contracts'] !== '0.0.12') {
  errors.push('API internal dependencies are not aligned to Phase 0.12');
}
for (const rel of ['apps/driver/package.json', 'apps/rider/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.dependencies['@dazat/contracts'] !== '0.0.12') errors.push(`${rel} contract dependency is not aligned to Phase 0.12`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.12 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.12 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus lifecycle, informed-offer, connectivity, scheduled-work, arrival, supply, Support and cross-workflow Safety boundaries.`);
