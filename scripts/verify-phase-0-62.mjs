import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const demo = readFileSync(join(root, 'scripts/demo-core-journey.mjs'), 'utf8');
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const errors = [];
for (const truth of ['projectCoreJourneyProgress', "booking_status: 'ACTIVE_INCIDENT'", "disposition, 'SUPPORT_REQUIRED'", "checkpoint: 'engineering-phase-0."]) if (!demo.includes(truth)) errors.push(`Vertical-slice demo truth missing: ${truth}`);
if (!packageJson.includes('npm run build --workspace @dazat/api && node scripts/demo-core-journey.mjs')) errors.push('Demo must compile the API projection before execution');
if (errors.length) { console.error('DAZAT Engineering Phase 0.62 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.62 verification PASSED');
