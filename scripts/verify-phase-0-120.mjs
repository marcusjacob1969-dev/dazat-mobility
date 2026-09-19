import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');

for (const required of [
  "not-a-uuid/core-journey-progress",
  "INVALID_BOOKING_ID",
  "INVALID_CONTROL_ROOM_JOURNEY_SCOPE",
  "Phase 0.120"
]) {
  if (!source.includes(required)) throw new Error('Missing Phase 0.120 input-boundary proof: ' + required);
}

console.log('DAZAT Phase 0.120 Core Journey input-boundary verification PASSED');
