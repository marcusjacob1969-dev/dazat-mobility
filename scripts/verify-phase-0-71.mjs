import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  "post('/v1/bookings'", '/quote`, registeredToken', '/confirm`, registeredToken', 'phase-071-create-booking',
  'phase-071-create-quote', 'phase-071-confirm-booking', "nextAction, 'DISPATCH'", 'productionChargingEnabled',
  'IDEMPOTENCY_KEY_REQUIRED', 'CORE_JOURNEY_NOT_FOUND'
]) if (!runner.includes(truth)) errors.push(`Rider write-flow verifier missing: ${truth}`);
const checkpoint = app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/)?.[1];
if (!checkpoint || Number(checkpoint) < 71) errors.push('Build metadata predates Phase 0.71');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.71 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.71 verification PASSED');
