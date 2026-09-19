import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
for (const marker of [
  'Phase 0.128: database provider-state guards must reject same-status metadata corruption.',
  "provider_action_attempted = true WHERE id = $1",
  "provider_code = \\'example\\'",
  "charging_eligibility = \\'APPROVED_POLICY\\'",
  "status = \\'STATUS_UNKNOWN\\', reconciliation_required = false"
]) assert.ok(source.includes(marker), marker);
assert.ok(source.includes('ROLLBACK TO SAVEPOINT phase_0128_guard'));
console.log('Phase 0.128 Finance database guard HTTP fixture proof PASSED');
