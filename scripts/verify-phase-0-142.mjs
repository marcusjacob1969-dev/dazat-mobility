import { readFileSync } from 'node:fs';
const verifier = readFileSync('scripts/verify-current.mjs', 'utf8');
if (!verifier.includes('phase <= 141')) throw new Error('Current verifier does not include Phase 0.141');
console.log('Phase 0.142 checkpoint continuity PASSED');
