import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');
assert.equal(source.includes('directly.\\n  for (const forbiddenStatus'), false);
assert.match(source, /Phase 0\.141:[\s\S]*forbiddenStatus/);
console.log('Phase 0.146 source verification PASSED');
