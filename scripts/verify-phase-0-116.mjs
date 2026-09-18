import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const verifier = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
for (const required of [
  "get('/v1/driver/earnings', tokens.actor)",
  "expectCode(riderCannotReadDriverEarnings, 403)",
  "get('/v1/receipts/' + ids.completedBooking, driverToken)",
  "expectCode(driverCannotReadRiderReceipt, 403)"
]) {
  if (!verifier.includes(required)) throw new Error('Finance role-isolation proof missing: ' + required);
}
console.log('DAZAT Phase 0.116 Finance role isolation verification PASSED');
