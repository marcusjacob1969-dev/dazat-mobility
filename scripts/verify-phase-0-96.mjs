import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const demo = readFileSync(join(root, 'scripts/demo-core-journey.mjs'), 'utf8');
const currentVerifier = readFileSync(join(root, 'scripts/verify-current.mjs'), 'utf8');
const errors = [];

if (!demo.includes('happy-path')) {
  errors.push('The executable core-journey demo must retain the canonical happy-path scenario');
}
if (demo.includes("checkpoint: 'engineering-phase-0.80'")) {
  errors.push('The executable core-journey demo still advertises the stale Phase 0.80 checkpoint');
}
const currentRange = currentVerifier.match(/for \(let phase = (\d+); phase <= (\d+); phase \+= 1\)/);
if (!currentRange) {
  errors.push('Current-checkpoint verifier must declare an executable phase range');
} else if (Number(currentRange[1]) !== 25 || Number(currentRange[2]) < 96) {
  errors.push('Current-checkpoint verifier must cover every checkpoint from Phase 0.25 through at least Phase 0.96');
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.96 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.96 verification PASSED');
