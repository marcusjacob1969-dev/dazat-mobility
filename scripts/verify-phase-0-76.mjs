import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  '/ridecheck/start`, registeredToken', 'challengeCodeReturnedOnce', "'challengeCode' in rideCheckReplay.json()",
  '/ridecheck/verify`, driverToken', "bookingStatus, 'PASSENGER_VERIFIED'", '/start`, driverToken',
  "journeyStatus, 'IN_PROGRESS'", 'journeyStartedReplay.json(), journeyStarted.json()',
  'driverInProgress.json(), riderInProgress.json()', "milestone.name === 'RIDECHECK'"
]) if (!runner.includes(truth)) errors.push(`RideCheck-to-start HTTP verifier missing: ${truth}`);
if (!app.includes("checkpoint: 'engineering-phase-0.76'")) errors.push('Build metadata is not at Phase 0.76');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.76 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.76 verification PASSED');
