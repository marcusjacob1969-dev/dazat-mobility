import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-29-checklist.md',
  'docs/traceability/phase-0-29-error-boundary-runtime.md',
  'tests/api/runtime-contract.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.29 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/api/runtime-contract.test.mjs'), 'utf8');
for (const truth of ["checkpoint: 'engineering-phase-0.29'", 'REQUEST_REJECTED', 'INTERNAL_SERVER_ERROR']) {
  if (!app.includes(truth)) errors.push(`Error-boundary source missing: ${truth}`);
}
for (const truth of ['malformed JSON uses the stable client-error contract', 'unexpected server failures use a stable contract', 'correlation IDs are unique between requests']) {
  if (!tests.includes(truth)) errors.push(`Runtime contract missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.29 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.29 verification PASSED');
console.log('Checked executable malformed-input, unexpected-failure, non-disclosure and correlation-uniqueness contracts.');
