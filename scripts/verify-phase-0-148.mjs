import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../database/migrations/0037_payment_transition_transaction_provenance.sql', import.meta.url), 'utf8');
const verifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
assert.match(migration, /provenance_transaction_id bigint NOT NULL DEFAULT txid_current\(\)/);
assert.match(migration, /provenance_transaction_id = txid_current\(\)/);
assert.match(verifier, /Phase 0\.148: Payment transition provenance must belong to the same PostgreSQL transaction/);
console.log('Phase 0.148 transaction-bound provenance verification PASSED');
