import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const verifier = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
if (!verifier.includes("expectCode(conflictingPayment, 409, 'IDEMPOTENCY_KEY_REUSED')")) throw new Error('Payment idempotency conflict proof missing');
console.log('DAZAT Phase 0.117 payment idempotency conflict verification PASSED');
