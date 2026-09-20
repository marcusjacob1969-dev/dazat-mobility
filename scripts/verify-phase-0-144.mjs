import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../database/migrations/0036_payment_transition_provenance.sql', import.meta.url), 'utf8');
const verifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');

assert.match(migration, /CREATE OR REPLACE FUNCTION finance\.guard_payment_transition_provenance/);
assert.match(migration, /CREATE CONSTRAINT TRIGGER payment_transition_provenance_guard/);
assert.match(migration, /AFTER UPDATE OF status ON finance\.payment/);
assert.match(migration, /DEFERRABLE INITIALLY IMMEDIATE/);
assert.match(migration, /payment_transition/);
assert.match(migration, /from_status = OLD\.status/);
assert.match(migration, /to_status = NEW\.status/);
assert.match(verifier, /Phase 0\.144:[\s\S]*payment_transition/, 'Core PostgreSQL verifier must exercise Payment transition provenance');

console.log('Phase 0.144 source verification PASSED');
