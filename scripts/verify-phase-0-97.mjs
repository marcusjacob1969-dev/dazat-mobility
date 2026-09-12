import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredAdapters = [
  'apps/rider/src/core-journey-api.ts',
  'apps/driver/src/core-journey-api.ts',
  'apps/control-room/src/core-journey-api.ts'
];
const errors = [];

for (const relativePath of requiredAdapters) {
  const source = readFileSync(join(root, relativePath), 'utf8');
  if (!source.includes('CoreJourneyProgressProjection')) errors.push(`${relativePath} must consume the canonical CoreJourneyProgressProjection contract`);
  if (!source.includes('authorization: `Bearer ${')) errors.push(`${relativePath} must send an authenticated bearer session`);
  if (!source.includes('response.ok')) errors.push(`${relativePath} must fail closed on non-success responses`);
}

const rider = readFileSync(join(root, 'apps/rider/src/core-journey-api.ts'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/src/core-journey-api.ts'), 'utf8');
const controlRoom = readFileSync(join(root, 'apps/control-room/src/core-journey-api.ts'), 'utf8');
if (!rider.includes('/v1/bookings/${bookingId}/core-journey-progress')) errors.push('Rider adapter must use the canonical Booking-scoped progress route');
if (!driver.includes('/v1/driver/bookings/${bookingId}/core-journey-progress')) errors.push('Driver adapter must use the assignment-authorised progress route');
if (!controlRoom.includes('/v1/control-room/fatigue-handovers/')) errors.push('Control Room adapter must remain task-scoped');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.97 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.97 verification PASSED');
