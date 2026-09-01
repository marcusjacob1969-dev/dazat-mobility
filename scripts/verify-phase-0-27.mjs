import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-27-checklist.md',
  'docs/traceability/phase-0-27-http-security.md',
  'tests/api/runtime-contract.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.27 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const truth of ['bodyLimit: 1_048_576', "'cache-control': 'no-store'", "'x-content-type-options': 'nosniff'", "'x-frame-options': 'DENY'"]) {
  if (!app.includes(truth)) errors.push(`HTTP security source missing: ${truth}`);
}
const checkpoint = app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/);
if (!checkpoint || Number(checkpoint[1]) < 27) errors.push('API factory checkpoint predates Phase 0.27');
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
if (!workflow.includes('branches: [main]')) errors.push('Hosted CI does not target main');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.27 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.27 verification PASSED');
console.log('Checked hosted main-branch CI, request body ceiling and fail-closed HTTP response headers.');
