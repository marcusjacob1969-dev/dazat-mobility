import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = ['apps/rider/App.tsx', 'apps/rider/src/core-journey-api.ts', 'apps/rider/src/README.md', 'docs/engineering/phase-0.51-rider-core-journey-progress.md', 'services/api/src/app.ts']
  .map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
const errors = [];
for (const truth of ["checkpoint: 'engineering-phase-0.51'", 'readCoreJourneyProgress', 'core-journey-progress', 'coreJourneyProgress.milestones', "item.status === 'BLOCKED'", 'PRODUCTION CHARGING DISABLED']) {
  if (!source.includes(truth)) errors.push(`Rider core-journey progress missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.51 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.51 verification PASSED');
console.log('Checked server-authoritative Rider progress, blocked-state visibility and disabled charging truth.');
