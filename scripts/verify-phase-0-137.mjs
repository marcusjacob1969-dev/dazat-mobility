import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const verifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
const proofs = [
  'provider-disabled finance exposes no capture/charge/refund mutation surface',
  '/v1/payments/${ids.completedPayment}/capture',
  '/v1/payments/${ids.completedPayment}/charge',
  '/v1/payments/${ids.completedPayment}/refund',
  '/v1/bookings/${ids.completedBooking}/capture-payment',
  '/v1/bookings/${ids.completedBooking}/charge-payment',
  'capturePayment', 'chargePayment', 'refundPayment', 'providerCapture', 'providerCharge', 'providerRefund'
];
for (const proof of proofs) assert.ok(verifier.includes(proof), 'Missing provider-disabled boundary proof: ' + proof);
console.log('DAZAT Phase 0.137 provider-disabled capture boundary proof wiring PASSED');