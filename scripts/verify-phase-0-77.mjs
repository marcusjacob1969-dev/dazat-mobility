import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  '/telemetry/location`, driverToken', 'movementPlausible, true', '/arriving`, driverToken',
  "journeyStatus, 'ARRIVING'", '/complete`, driverToken', 'completedLiveJourneyReplay.json(), completedLiveJourney.json()',
  'driverCompletedProgress.json(), riderCompletedProgress.json()', "nextAction, 'PAYMENT_PROVIDER_UNAVAILABLE'",
  "availabilityStatus, 'AVAILABLE'"
]) if (!runner.includes(truth)) errors.push(`Live completion HTTP verifier missing: ${truth}`);
if (!app.includes("checkpoint: 'engineering-phase-0.77'")) errors.push('Build metadata is not at Phase 0.77');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.77 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.77 verification PASSED');
