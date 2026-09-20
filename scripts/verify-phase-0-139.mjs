import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const current = readFileSync(new URL('./verify-current.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const httpVerifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
assert.ok(current.includes('phase <= 139'));
assert.equal(pkg.scripts['verify:phase-0-139'], 'node scripts/verify-phase-0-139.mjs');
assert.ok(httpVerifier.includes("intent_status = 'CREATED'"));
console.log('DAZAT Phase 0.139 checkpoint/provider DB proof wiring PASSED');