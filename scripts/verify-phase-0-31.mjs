import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-31-checklist.md',
  'docs/traceability/phase-0-31-network-trust.md',
  'tests/api/runtime-contract.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.31 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/api/runtime-contract.test.mjs'), 'utf8');
for (const truth of ['trustProxy: false', 'connectionTimeout: 10_000', 'requestTimeout: 30_000', 'keepAliveTimeout: 5_000', 'maxRequestsPerSocket: 100']) {
  if (!app.includes(truth)) errors.push(`Network-trust source missing: ${truth}`);
}
const checkpoint = app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/);
if (!checkpoint || Number(checkpoint[1]) < 31) errors.push('API factory checkpoint predates Phase 0.31');
for (const truth of ['caller forwarding headers cannot impersonate a trusted edge', 'network timeout and connection reuse limits are explicit']) {
  if (!tests.includes(truth)) errors.push(`Runtime network contract missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.31 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.31 verification PASSED');
console.log('Checked executable forwarding-header distrust and bounded network resource contracts.');
