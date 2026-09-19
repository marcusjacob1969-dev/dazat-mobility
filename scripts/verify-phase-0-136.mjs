import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const verifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
const proofs = ["UPDATE finance.payment SET currency = 'EUR'","UPDATE finance.payment SET authorised_amount_minor = 3201","UPDATE finance.payment SET captured_amount_minor = 3201","UPDATE finance.payment SET refunded_amount_minor = 1","UPDATE finance.payment SET status = 'CAPTURED', captured_amount_minor = 0","UPDATE finance.payment SET status = 'REFUNDED', refunded_amount_minor = 0","UPDATE finance.payment SET status = 'REFUNDED', refunded_amount_minor = captured_amount_minor - 1","UPDATE finance.payment_intent SET amount_minor = 1000","UPDATE finance.payment_intent SET currency = 'EUR'","UPDATE finance.payment_intent SET status = 'CREATED'"];
for (const proof of proofs) assert.ok(verifier.includes(proof), 'Missing DB proof: ' + proof);
console.log('DAZAT Phase 0.136 Payment/PaymentIntent database consistency proof wiring PASSED');
