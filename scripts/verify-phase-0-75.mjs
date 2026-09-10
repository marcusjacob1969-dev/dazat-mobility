import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  '/journey/acknowledge`, driverToken', "journeyStatus, 'EN_ROUTE'", '/location-observations`, driverToken',
  "telemetryState, 'LIVE'", '/arrived`, driverToken', "bookingStatus, 'DRIVER_ARRIVED'",
  'arrivedReplay.json(), arrived.json()', 'driverArrivedProgress.json(), riderArrivedProgress.json()',
  "milestone.name === 'ARRIVAL'"
]) if (!runner.includes(truth)) errors.push(`Assignment-to-arrival HTTP verifier missing: ${truth}`);
if (!app.includes("checkpoint: 'engineering-phase-0.75'")) errors.push('Build metadata is not at Phase 0.75');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.75 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.75 verification PASSED');
