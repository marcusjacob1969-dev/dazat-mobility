import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../database/migrations/0034_payment_intent_consistency.sql', import.meta.url), 'utf8');

for (const marker of [
  'finance.guard_payment_intent_consistency()',
  'Payment currency must match PaymentIntent currency',
  'Authorised payment amount cannot exceed PaymentIntent amount',
  'Captured payment amount cannot exceed PaymentIntent amount',
  'Refunded payment amount cannot exceed captured payment amount',
  'Captured payment state requires a positive captured amount',
  'REFUNDED payment must have refunded amount equal to captured amount',
  'A CREATED PaymentIntent cannot have a captured Payment',
  'CREATE TRIGGER payment_intent_consistency_guard'
]) assert.ok(migration.includes(marker), marker);

assert.ok(
  migration.includes('BEFORE INSERT OR UPDATE OF payment_intent_id, status, authorised_amount_minor, captured_amount_minor, refunded_amount_minor, currency'),
  'Payment consistency guard must cover inserts and mutable consistency fields'
);

console.log('DAZAT Phase 0.131 PaymentIntent/Payment consistency verification PASSED');
