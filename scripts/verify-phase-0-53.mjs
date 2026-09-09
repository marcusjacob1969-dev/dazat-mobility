import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'scripts/demo-core-journey.mjs'), 'utf8') + readFileSync(join(root, 'package.json'), 'utf8');
const errors = [];
for (const truth of ['demo:core-journey', 'runProviderDisabledCoreJourney', 'FATIGUE_SAFETY_BLOCKED', 'RIDECHECK_MISMATCH', 'ACTIVE_COMPLETION_HOLD', 'productionSafeDemo: true']) if (!source.includes(truth)) errors.push(`Core journey demo missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.53 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.53 verification PASSED');
