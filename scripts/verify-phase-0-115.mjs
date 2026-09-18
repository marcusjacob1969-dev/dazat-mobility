import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const verifier = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
for (const required of [
  "get('/v1/receipts/' + ids.completedBooking, tokens.actor)",
  "get('/v1/driver/earnings', tokens.actor)",
  'assert.equal(completedEarnings.json().payoutDerivedFromEarnings, false)',
  'assert.equal(completedEarnings.json().riderFareUsedAsDriverEarning, false)',
  'assert.equal(completed.json().productionChargingEnabled, false)'
]) {
  if (!verifier.includes(required)) throw new Error('Completed vertical proof missing: ' + required);
}
console.log('DAZAT Phase 0.115 completed Journey vertical proof verification PASSED');
