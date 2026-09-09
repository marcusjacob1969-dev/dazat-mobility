import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const errors = [];
for (const truth of ['for phase in $(seq 25 54)', 'npm run "verify:phase-0-${phase}"', 'npm run test:api-runtime', 'npm run demo:core-journey', 'npm run build --workspaces --if-present']) if (!workflow.includes(truth)) errors.push(`Continuous verification missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.54 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.54 verification PASSED');
