import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0004_dispatch_driver_eligibility_foundation.sql',
  'packages/domain/src/dispatch.ts',
  'packages/contracts/src/dispatch.ts',
  'services/api/src/modules/dispatch/dispatch-service.ts',
  'services/api/src/modules/dispatch/routes.ts',
  'apps/driver/src/dispatch-api.ts',
  'apps/rider/src/dispatch-api.ts',
  'docs/architecture/ADR-0004-dispatch-driver-eligibility-assignment.md',
  'docs/engineering/phase-0-4-checklist.md',
  'docs/traceability/phase-0-4-requirements.md',
  'tests/domain/dispatch.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.4 file: ${rel}`);

const sql = readFileSync(join(root, 'database/migrations/0004_dispatch_driver_eligibility_foundation.sql'), 'utf8');
for (const object of [
  'compliance.driver_eligibility_snapshot', 'compliance.vehicle_eligibility_snapshot',
  'driver.availability_state', 'driver.availability_transition', 'dispatch.dispatch_attempt',
  'dispatch.candidate_snapshot', 'dispatch.driver_offer', 'dispatch.driver_assignment',
  'dispatch_one_active_assignment_per_booking', 'dispatch_one_active_assignment_per_driver',
  'dispatch.command_deduplication', 'dispatch.outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.4 persistence object: ${object}`);
if (!sql.includes('append-only')) errors.push('Compliance snapshot append-only rule missing');

const domain = readFileSync(join(root, 'packages/domain/src/dispatch.ts'), 'utf8');
for (const blocker of [
  'COMPLIANCE_EXPIRED', 'VEHICLE_NOT_AUTHORISED', 'LOCATION_STALE',
  'ACTIVE_ASSIGNMENT', 'SCHEDULE_CONFLICT', 'HARD_REQUIREMENT_MISMATCH'
]) if (!domain.includes(blocker)) errors.push(`Hard eligibility blocker missing: ${blocker}`);
if (!domain.includes('evaluateDriverDispatchEligibility')) errors.push('Pure hard-filter decision function missing');

const service = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
if (!service.includes("EXCLUDED.status = 'OFFLINE' THEN NULL")) errors.push('OFFLINE ordinary-location clearing rule missing');
if (!service.includes('FOR UPDATE')) errors.push('Dispatch acceptance does not lock authoritative state');
if (!service.includes("status = 'WITHDRAWN'")) errors.push('Competing offers are not withdrawn after assignment');
if (!service.includes('acceptanceRatePenaltyApplied: false')) errors.push('Non-punitive Driver offer decline contract missing');
if (!service.includes("'NO_ELIGIBLE_DRIVER'")) errors.push('Truthful no-eligible-driver state missing');
if (!service.includes('hardRequirementsMatch')) errors.push('Booking hard-requirement matching missing');
if (!service.includes('provisionalStraightLineDistanceOnly')) errors.push('Provisional distance is not explicitly distinguished from ETA');
if (!service.includes('assertDriverAvailabilityTransition')) errors.push('Driver availability transition guard missing');
if (!service.includes('dispatch.driver.assigned')) errors.push('Driver assignment outbox event missing');

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const action of ['getDriverEligibility', 'setDriverAvailability', 'listDriverOffers', 'acceptDriverOffer', 'declineDriverOffer']) {
  if (!driver.includes(action)) errors.push(`Driver Phase 0.4 slice is not wired to ${action}`);
}
if (!driver.includes('all hard checks must pass before Dispatch')) errors.push('Driver UI does not explain authentication/eligibility separation');

const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
if (!rider.includes('startBookingDispatch')) errors.push('Rider cannot start the Dispatch command');
if (!rider.includes('never invents a driver or ETA')) errors.push('Rider UI lacks truthful Dispatch expectation');

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/v1/driver/eligibility', '/v1/driver/availability', '/v1/driver/offers', '/dispatch:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.4 path missing: ${path}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.4 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.4 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus hard eligibility, stale-location, truthful no-driver, controlled-offer and atomic-assignment guards.`);
