import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../database/migrations/0032_finance_provider_state_invariants.sql', import.meta.url), 'utf8');

for (const required of [
  'CREATE OR REPLACE FUNCTION finance.guard_payment_intent_provider_state()',
  'CREATE TRIGGER payment_intent_provider_state_guard',
  'BEFORE INSERT OR UPDATE OF status, charging_eligibility, provider_code,',
  'provider_intent_reference, provider_action_attempted, reconciliation_required',
  "NEW.status = 'CREATED'",
  "NEW.status = 'STATUS_UNKNOWN'",
  'NEW.provider_action_attempted = true',
  'NEW.provider_action_attempted = false',
  "NEW.provider_code IS NOT NULL",
  "NEW.provider_intent_reference IS NOT NULL"
]) {
  assert.ok(migration.includes(required), 'Phase 0.127 migration is missing: ' + required);
}
assert.ok(migration.includes("RAISE EXCEPTION 'CREATED PaymentIntent must remain provider-neutral'"));
assert.ok(migration.includes("RAISE EXCEPTION 'Provider action requires approved policy and provider references'"));
assert.ok(migration.includes("RAISE EXCEPTION 'Provider references require provider_action_attempted=true'"));
assert.ok(migration.includes("RAISE EXCEPTION 'STATUS_UNKNOWN requires reconciliation'"));

console.log('DAZAT Phase 0.127 Finance database provider-state invariant verification PASSED');
