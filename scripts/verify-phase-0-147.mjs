import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./verify-current.mjs', import.meta.url), 'utf8');
assert.match(source, /phase <= 146/);
assert.match(source, /verify-phase-0-146\\.mjs/);
console.log('Phase 0.147 aggregate verifier chain verification PASSED');
