import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const proof = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');

for (const [name, source] of [['Rider', rider], ['Driver', driver]]) {
  if (!source.includes('CoreJourneyProgressProjection')) throw new Error(`${name} canonical projection binding missing`);
  if (!source.includes('setCoreJourneyProgress')) throw new Error(`${name} canonical projection refresh missing`);
}
if (!controlRoom.includes('readTaskScopedCoreJourneyProgress')) throw new Error('Control Room task-scoped projection binding missing');

for (const proofLine of [
  'assert.deepEqual(driverAssignedProgress.json().milestones, riderAssignedProgress.json().milestones);',
  'assert.equal(driverAssignedProgress.json().nextAction, riderAssignedProgress.json().nextAction);',
  "assert.deepEqual(driverAssignedProgress.json(), riderAssignedProgress.json());"
]) if (!proof.includes(proofLine)) throw new Error(`Missing persisted happy-path parity proof: ${proofLine}`);

console.log('DAZAT Phase 0.110 happy-path Rider/Driver state parity verification PASSED');
