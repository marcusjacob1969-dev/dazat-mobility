import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');

const required = [
  ['Rider canonical projection', rider, 'CoreJourneyProgressProjection'],
  ['Rider next-action presentation', rider, 'coreJourneyProgress.nextAction'],
  ['Rider blocked-state presentation', rider, "item.status === 'BLOCKED'"],
  ['Rider stale-location guard', rider, 'Stale or unknown location is never presented as live certainty'],
  ['Driver canonical projection', driver, 'CoreJourneyProgressProjection'],
  ['Driver next-action presentation', driver, 'coreJourneyProgress.nextAction'],
  ['Control Room canonical projection', controlRoom, 'CoreJourneyProgressProjection'],
  ['Control Room support-required state', controlRoom, 'SUPPORT_REQUIRED'],
  ['Control Room blocked-state visibility', controlRoom, 'BLOCKED']
];

for (const [label, source, needle] of required) {
  if (!source.includes(needle)) throw new Error(`${label} missing: ${needle}`);
}

if (!rider.includes('ENGINEERING PHASE 0.101 · CANONICAL JOURNEY EXPERIENCE')) {
  throw new Error('Rider UI is not reporting Phase 0.101 canonical journey experience.');
}

if (!rider.includes('PRODUCTION CHARGING DISABLED')) {
  throw new Error('Rider UI must keep production charging visibly disabled.');
}

console.log('DAZAT Phase 0.101 canonical journey UX verification PASSED');
