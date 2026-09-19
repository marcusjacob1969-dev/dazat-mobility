import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');

assert.match(source, /INVALID_BOOKING_ID/);
assert.match(source, /INVALID_CONTROL_ROOM_JOURNEY_SCOPE/);
assert.match(source, /not-a-uuid/);
assert.match(source, /unexpected=1/);

console.log('Phase 0.120 source verifier PASSED');
