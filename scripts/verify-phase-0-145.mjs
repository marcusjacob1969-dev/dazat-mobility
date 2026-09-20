import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./verify-current.mjs', import.meta.url), 'utf8');
assert.match(source, /phase <= 146/);
console.log('Phase 0.145 source verification PASSED');
