import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0005_assignment_pickup_ridecheck_foundation.sql',
  'packages/domain/src/journey.ts',
  'packages/contracts/src/journey.ts',
  'services/api/src/modules/journey/journey-service.ts',
  'services/api/src/modules/journey/routes.ts',
  'apps/driver/src/journey-api.ts',
  'apps/rider/src/journey-api.ts',
  'docs/architecture/ADR-0005-assignment-pickup-ridecheck-protected-start.md',
  'docs/engineering/phase-0-5-checklist.md',
  'docs/traceability/phase-0-5-requirements.md',
  'tests/domain/journey-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.5 file: ${rel}`);

const migrationPath = join(root, 'database/migrations/0005_assignment_pickup_ridecheck_foundation.sql');
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
for (const object of [
  'journey.journey', 'journey.journey_leg', 'journey.state_transition',
  'journey.driver_location_observation', 'journey.arrival_evidence',
  'journey.ridecheck_session', 'journey.ridecheck_attempt',
  'journey.operational_hold', 'safety.safety_event', 'journey.command_deduplication',
  'journey.outbox_message', 'journey.control_room_projection'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.5 persistence object: ${object}`);
if (!sql.includes('raw RideCheck challenge must never be persisted')) errors.push('Raw RideCheck persistence prohibition missing');
if (!sql.includes('BEFORE UPDATE OR DELETE ON journey.driver_location_observation')) errors.push('Location evidence append-only trigger missing');
if (!sql.includes('BEFORE UPDATE OR DELETE ON journey.ridecheck_attempt')) errors.push('RideCheck attempt append-only trigger missing');

const domain = readFileSync(join(root, 'packages/domain/src/journey.ts'), 'utf8');
for (const guard of ['evaluateLocationEvidence', 'evaluateArrivalEvidence', 'evaluateRideCheckAttempt', 'canStartJourney']) {
  if (!domain.includes(guard)) errors.push(`Missing pure Journey guard: ${guard}`);
}
if (domain.includes("ASSIGNED: ['IN_PROGRESS']") || domain.includes("ARRIVED: ['IN_PROGRESS']")) {
  errors.push('Unsafe Journey start shortcut present');
}

const service = readFileSync(join(root, 'services/api/src/modules/journey/journey-service.ts'), 'utf8');
for (const guard of [
  'FOR UPDATE OF j, b, da, leg', 'constantTimeHexEqual', 'hashVerificationCode',
  'assignmentStillEligible', 'ACTIVE_OPERATIONAL_OR_SAFETY_HOLD',
  'ARRIVAL_EVIDENCE_MISSING', 'OUTSIDE_ARRIVAL_RADIUS', 'mismatchCreatesMisconductFinding: false',
  'safety.ridecheck.intervention_required', 'requiresAuthoritativeRefreshBeforeMutation: true'
]) if (!service.includes(guard)) errors.push(`Missing Journey transactional/security guard: ${guard}`);
if (!service.includes('challengeCodeReturnedOnce: false')) errors.push('RideCheck idempotent replay does not suppress raw challenge');
if (!service.includes("journeyStatus !== 'PASSENGER_VERIFIED'")) errors.push('Protected start passenger-verification guard missing');
if (!service.includes('Phase 0.5 PIN RideCheck requires the self-booking passenger')) errors.push('Self-booker PIN RideCheck actor boundary missing');
if (!service.includes('clientObservationId was reused with different location evidence')) errors.push('Location observation conflicting-replay guard missing');
if (!service.includes('service_capabilities')) errors.push('Start does not revalidate Booking hard requirements against vehicle capability');

const routes = readFileSync(join(root, 'services/api/src/modules/journey/routes.ts'), 'utf8');
for (const path of ['/location-observations', '/arrived', '/ridecheck/start', '/ridecheck/verify', '/start', '/live']) {
  if (!routes.includes(path)) errors.push(`Journey API route missing: ${path}`);
}
if (routes.toLowerCase().includes('bypass')) errors.push('Normal Journey API exposes a bypass path');

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const action of ['acknowledgeAssignment', 'sendPickupLocation', 'markArrived', 'verifyPickupRideCheck', 'beginJourney']) {
  if (!driver.includes(action)) errors.push(`Driver pickup journey is not wired to ${action}`);
}
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
if (!rider.includes('startPassengerRideCheck')) errors.push('Rider cannot start protected RideCheck');
if (!rider.includes('returned once and is not stored as plaintext')) errors.push('Rider UI lacks one-time RideCheck secret expectation');

const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
if (!controlRoom.includes('normal support cannot bypass')) errors.push('Control Room protected-start boundary missing');
if (!controlRoom.includes('STALE or UNKNOWN')) errors.push('Control Room telemetry uncertainty missing');

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/journey/acknowledge', '/location-observations:', '/ridecheck/start:', '/ridecheck/verify:', '/start:', '/live:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.5 path missing: ${path}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.5 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.5 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus state, telemetry, arrival, RideCheck, Safety-hold, idempotency and protected-start guards.`);
