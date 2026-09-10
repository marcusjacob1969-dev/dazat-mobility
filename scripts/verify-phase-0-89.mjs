import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const errors = [];
for (const truth of [
  'permissions:\n  contents: read',
  'concurrency:',
  'group: dazat-verification-${{ github.workflow }}-${{ github.ref }}',
  'cancel-in-progress: true',
  'timeout-minutes: 15',
  'timeout-minutes: 10'
]) if (!workflow.includes(truth)) errors.push(`Hosted verification missing bounded concurrency truth: ${truth}`);
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.89 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.89 verification PASSED');
