import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const verifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
assert.ok(verifier.includes('Phase 0.140: a provider-disabled CREATED PaymentIntent cannot acquire a captured Payment directly in PostgreSQL.'));
assert.ok(verifier.includes("phase-0-140-forbidden-capture"));
assert.ok(verifier.includes("preparedPayment.json().paymentIntentId"));
console.log('DAZAT Phase 0.140 provider-disabled database capture invariant wiring PASSED');
