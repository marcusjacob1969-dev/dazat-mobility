import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = ['apps/control-room/src/App.tsx', 'apps/control-room/src/core-journey-api.ts'].map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
const errors = [];
for (const truth of ['readTaskScopedCoreJourneyProgress', "type=\"password\"", "cache: 'no-store'", 'journeyProgress.milestones.map', 'controlledHandoverId']) if (!source.includes(truth)) errors.push(`Control Room journey UI missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.66 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.66 verification PASSED');
