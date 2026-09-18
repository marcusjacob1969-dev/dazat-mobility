import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
const contract = readFileSync(join(root, 'packages/contracts/src/core-journey-progress.ts'), 'utf8');

for (const required of [
  "journeyProgress?.disposition === 'SUPPORT_REQUIRED'",
  'aria-label="Control Room active Safety hold"',
  'Canonical reason:',
  'cannot clear the hold or rewrite Journey state from the client'
]) {
  if (!controlRoom.includes(required)) throw new Error(`Control Room Safety visibility binding missing: ${required}`);
}
if (!contract.includes("CoreJourneyDisposition = 'ACTIVE' | 'CLOSED' | 'SUPPORT_REQUIRED'")) throw new Error('Canonical support-required disposition missing');

console.log('DAZAT Phase 0.114 Control Room Safety visibility verification PASSED');
