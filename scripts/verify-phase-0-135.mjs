import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../database/migrations/0034_payment_intent_consistency.sql', import.meta.url), 'utf8');
assert.equal((migration.match(/RETURNS trigger LANGUAGE plpgsql AS \$\$/g) ?? []).length, 2);
assert.equal((migration.match(/END \$\$;/g) ?? []).length, 2);
assert.doesNotMatch(migration, /RETURNS trigger LANGUAGE plpgsql AS \$\nBEGIN/);
console.log('DAZAT Phase 0.135 payment consistency migration delimiter verification PASSED');
