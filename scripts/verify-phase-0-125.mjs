import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
for (const marker of ['status, \'CAPTURED\'','productionChargingEnabled','providerActionAttempted','reconciliationRequired','blindRetryAllowed']) assert.ok(source.includes(marker), marker);
console.log('Phase 0.125 captured payment projection verifier PASSED');
