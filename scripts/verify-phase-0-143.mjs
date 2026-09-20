import { readFileSync } from 'node:fs';
const migration = readFileSync('database/migrations/0035_payment_status_transition_guard.sql', 'utf8');
const verifier = readFileSync('scripts/verify-core-journey-http-postgres.mjs', 'utf8');
for (const value of ['payment_status_transition_guard','Invalid Payment status transition','CREATED','AUTHORISED']) {
  if (!migration.includes(value)) throw new Error('Phase 0.143 migration proof missing: ' + value);
}
if (!verifier.includes('Phase 0.143')) throw new Error('Phase 0.143 runtime proof missing');
console.log('Phase 0.143 verifier wiring PASSED');
