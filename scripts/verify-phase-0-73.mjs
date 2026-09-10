import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  '/dispatch`, registeredToken', 'phase-073-start-dispatch', "bookingStatus, 'NO_ELIGIBLE_DRIVER'",
  "dispatchStatus, 'NO_ELIGIBLE_DRIVER'", 'eligibleCandidateCount, 0', 'offeredDriverCount, 0',
  "disposition, 'SUPPORT_REQUIRED'", "nextAction, 'SUPPORT_REQUIRED'", "milestone.name === 'DRIVER_ASSIGNED'"
]) if (!runner.includes(truth)) errors.push(`Dispatch HTTP verifier missing: ${truth}`);
const checkpoint = Number(app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/)?.[1] ?? -1);
if (checkpoint < 73) errors.push('Build metadata predates Phase 0.73');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.73 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.73 verification PASSED');
