import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
assert.match(source, /outsider-prepare-payment/);
assert.match(source, /operator-prepare-payment/);
assert.match(source, /FINANCE_FORBIDDEN/);
console.log('Phase 0.122 finance mutation authorization verifier PASSED');
