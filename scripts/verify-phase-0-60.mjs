import { readFileSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); const source = ['openapi/dazat-api.yaml', 'apps/rider/App.tsx', 'apps/driver/App.tsx'].map((path) => readFileSync(join(root, path), 'utf8')).join('\n'); const errors = [];
for (const truth of ['JOURNEY_CLOSED]', "nextAction === 'JOURNEY_CLOSED'", 'Journey closed — no further action']) if (!source.includes(truth)) errors.push(`Terminal journey UX missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.60 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); } console.log('DAZAT Engineering Phase 0.60 verification PASSED');
