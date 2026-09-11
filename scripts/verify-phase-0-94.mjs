import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const currentVerifier = readFileSync(join(root, 'scripts/verify-current.mjs'), 'utf8');
const scripts = packageJson.scripts ?? {};
const errors = [];

if (scripts['verify:current'] !== 'node scripts/verify-current.mjs') {
  errors.push('Root package must expose the canonical current-checkpoint verifier');
}
if (scripts.check?.includes('npm run verify:current') !== true) {
  errors.push('Root check must execute the canonical current-checkpoint verifier');
}
if (scripts['verify:phase-0-93'] !== 'node scripts/verify-phase-0-93.mjs') {
  errors.push('Root package must expose the Phase 0.93 verifier');
}
const currentRange = currentVerifier.match(/for \(let phase = (\d+); phase <= (\d+); phase \+= 1\)/);
if (!currentRange) {
  errors.push('Current-checkpoint verifier must declare an executable phase range');
} else if (Number(currentRange[1]) !== 25 || Number(currentRange[2]) !== 93) {
  errors.push('Current-checkpoint verifier must cover every current checkpoint from Phase 0.25 through Phase 0.93');
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.94 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.94 verification PASSED');
