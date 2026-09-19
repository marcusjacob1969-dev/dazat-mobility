import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const verifier = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
const captureMigration = readFileSync(new URL('../database/migrations/0033_payment_capture_timestamp.sql', import.meta.url), 'utf8');

assert.match(captureMigration, /captured_at timestamptz/);
assert.match(captureMigration, /guard_payment_capture_timestamp/);
assert.match(captureMigration, /Captured payment state requires captured_at/);
assert.match(captureMigration, /Uncaptured payment state cannot have captured_at/);
assert.match(verifier, /UPDATE finance\.payment SET captured_at = NULL/);
assert.match(verifier, /UPDATE finance\.payment SET status = 'CREATED'/);

console.log('DAZAT Phase 0.133 payment capture integrity verification PASSED');
