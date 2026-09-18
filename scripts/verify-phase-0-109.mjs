import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const httpProof = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');

for (const [name, source] of [['Rider', rider], ['Driver', driver]]) {
  if (!source.includes('CoreJourneyProgressProjection')) throw new Error(`${name} must expose the canonical projection`);
  if (!source.includes('BLOCKED')) throw new Error(`${name} must render blocked canonical milestones`);
}
if (!controlRoom.includes('Core Journey')) throw new Error('Control Room must expose Core Journey operational truth');
if (!controlRoom.includes('Safety') || !controlRoom.includes('handover')) throw new Error('Control Room failure view must retain Safety/handover boundaries');

const requiredProofs = [
  "assert.deepEqual(driverIncidentMilestones, riderIncidentMilestones);",
  "assert.deepEqual(controlIncidentMilestones, riderIncidentMilestones);",
  "assert.equal(riderIncident.json().nextAction, 'SUPPORT_REQUIRED');",
  "assert.equal(driverIncident.json().nextAction, 'SUPPORT_REQUIRED');",
  "assert.equal(controlIncident.json().nextAction, 'SUPPORT_REQUIRED');"
];
for (const proof of requiredProofs) if (!httpProof.includes(proof)) throw new Error(`Missing executable failure proof: ${proof}`);

console.log('DAZAT Phase 0.109 cross-surface failure projection verification PASSED');
