import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../database/migrations/0034_payment_intent_consistency.sql', import.meta.url), 'utf8');
const runner = readFileSync(new URL('./verify-postgres-migrations.mjs', import.meta.url), 'utf8');

assert.equal((migration.match(/RETURNS trigger LANGUAGE plpgsql AS \\$\\$/g) ?? []).length, 2);
assert.doesNotMatch(migration, /RETURNS trigger LANGUAGE plpgsql AS \\$(?:\\n|\\r\\n)BEGIN/);
assert.match(runner, /migrations\.length !== 34/);
assert.match(runner, /0034_payment_intent_consistency\.sql/);
assert.match(runner, /payment_intent_consistency_guard/);
assert.match(runner, /payment_intent_amount_consistency_guard/);
assert.match(runner, /finance\.payment_intent/);

console.log('DAZAT Phase 0.132 migration-chain hardening verification PASSED');
