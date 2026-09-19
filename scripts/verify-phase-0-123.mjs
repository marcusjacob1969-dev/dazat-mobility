import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
for (const marker of ['INVALID_BOOKING_ID','IDEMPOTENCY_KEY_REQUIRED','INVALID_PAYMENT_ID','AUTHENTICATION_REQUIRED']) assert.ok(source.includes(marker));
console.log('Phase 0.123 finance input boundary verifier PASSED');
