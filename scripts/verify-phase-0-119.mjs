import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
for (const required of [
  "DRIVER_SESSION_REQUIRED",
  "CONTROL_ROOM_SESSION_REQUIRED",
  "401, 'AUTHENTICATION_REQUIRED'"
]) if (!source.includes(required)) throw new Error('Missing Phase 0.119 authentication proof: ' + required);
console.log('DAZAT Phase 0.119 Core Journey authentication verification PASSED');
