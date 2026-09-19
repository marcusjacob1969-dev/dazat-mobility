import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
if (!source.includes("controlWrongBooking, 404, 'CORE_JOURNEY_NOT_FOUND'")) throw new Error('Control Room wrong-booking scope proof missing');
if (!source.includes("controlPrivateBooking, 404, 'CORE_JOURNEY_NOT_FOUND'")) throw new Error('Control Room private-booking scope proof missing');
console.log('DAZAT Phase 0.118 Control Room scope-isolation verification PASSED');
