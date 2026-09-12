import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');

const rider = read('apps/rider/App.tsx');
const driver = read('apps/driver/App.tsx');
const controlRoom = read('apps/control-room/src/App.tsx');

const required = [
  [rider, 'CoreJourneyProgressProjection', 'Rider consumes the canonical Core Journey contract'],
  [rider, 'readCoreJourneyProgress', 'Rider reads canonical Core Journey progress'],
  [driver, 'CoreJourneyProgressProjection', 'Driver consumes the canonical Core Journey contract'],
  [driver, 'readDriverCoreJourneyProgress', 'Driver reads canonical Core Journey progress'],
  [controlRoom, 'CoreJourneyProgressProjection', 'Control Room consumes the canonical Core Journey contract'],
  [controlRoom, 'readTaskScopedCoreJourneyProgress', 'Control Room reads task-scoped canonical Core Journey progress'],
];

for (const [source, needle, message] of required) {
  if (!source.includes(needle)) throw new Error(`PHASE_0_100_FAILED: ${message}`);
}

for (const [name, source] of [['Rider', rider], ['Driver', driver], ['Control Room', controlRoom]]) {
  if (!source.includes('dazatTokens')) throw new Error(`PHASE_0_100_FAILED: ${name} is not using the DAZAT design system`);
}

console.log('DAZAT Phase 0.100 journey UI foundation verification PASSED');
