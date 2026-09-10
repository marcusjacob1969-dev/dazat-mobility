import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  "profileKind: 'DRIVER'", '/v1/driver/availability', '/v1/driver/offers', '/accept`, driverToken',
  "dispatchStatus, 'OFFERING'", 'eligibleCandidateCount, 1', 'offeredDriverCount, 1',
  'disclosure.informedChoiceReady', "bookingStatus, 'DRIVER_ASSIGNED'", 'driverAssignedProgress.json(), riderAssignedProgress.json()'
]) if (!runner.includes(truth)) errors.push(`Successful Dispatch HTTP verifier missing: ${truth}`);
for (const truth of ['developmentDispatchPickupEtaMinutes', 'developmentDriverEarningAmountMinor', "development-driver-earning-fixture-v1"]) {
  if (!dispatch.includes(truth) && !config.includes(truth)) errors.push(`Development disclosure boundary missing: ${truth}`);
}
const checkpoint = Number(app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/)?.[1] ?? -1);
if (checkpoint < 74) errors.push('Build metadata predates Phase 0.74');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.74 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.74 verification PASSED');
