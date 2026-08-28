import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'compose.yaml',
  'database/migrations/0001_foundation.sql',
  'docs/architecture/ADR-0001-production-foundation.md',
  'docs/architecture/domain-ownership.md',
  'packages/domain/src/booking-status.ts',
  'packages/contracts/src/booking.ts',
  'packages/design-system/src/tokens.ts',
  'services/api/src/main.ts',
  'openapi/dazat-api.yaml'
];

const errors = [];
for (const rel of required) {
  if (!existsSync(join(root, rel))) errors.push(`Missing required foundation file: ${rel}`);
}

const sql = readFileSync(join(root, 'database/migrations/0001_foundation.sql'), 'utf8');
for (const schema of ['identity','rider','driver','compliance','vehicle_fleet','booking','pricing','dispatch','journey','safety','operations','finance','communications','organisation','school','rescue','shield']) {
  if (!sql.includes(`CREATE SCHEMA IF NOT EXISTS ${schema};`)) errors.push(`Missing schema boundary: ${schema}`);
}
for (const status of ['DRAFT','QUOTE_CREATED','AWAITING_CONFIRMATION','CONFIRMED','READY_FOR_DISPATCH','SEARCHING_FOR_DRIVER','DRIVER_ASSIGNED','AWAITING_RIDECHECK','PASSENGER_VERIFIED','IN_PROGRESS','COMPLETED','PAYMENT_PROCESSING','PAID','CLOSED','NO_ELIGIBLE_DRIVER','SAFETY_HOLD','BREAKDOWN','REFUND_PENDING','REFUNDED']) {
  if (!sql.includes(`'${status}'`)) errors.push(`Missing canonical booking status in DB enum: ${status}`);
}
for (const role of ['BOOKER','PASSENGER','PAYER','GUARDIAN','AUTHORISED_CONTACT','ORGANISATION']) {
  if (!sql.includes(`'${role}'`)) errors.push(`Missing BookingParty role: ${role}`);
}
if (!sql.includes('booking.outbox_message')) errors.push('Transactional outbox table missing');
if (!sql.includes('prevent_transition_mutation')) errors.push('Append-only transition mutation guard missing');
if (!sql.includes('geography(Point,4326)')) errors.push('PostGIS location snapshot missing');

if (errors.length) {
  console.error('DAZAT foundation verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT foundation verification PASSED');
console.log(`Checked ${required.length} required files, domain schemas, Booking vocabulary, party roles, PostGIS and outbox/append-only guards.`);
