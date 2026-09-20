import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const verifier = readFileSync(join(process.cwd(), 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
if (!verifier.includes('Phase 0.141')) throw new Error('Phase 0.141 proof is missing');
if (!verifier.includes("forbiddenStatus, preparedPayment.json().paymentIntentId")) throw new Error('Phase 0.141 transition probe is missing');
console.log('Phase 0.141 verifier wiring PASSED');
