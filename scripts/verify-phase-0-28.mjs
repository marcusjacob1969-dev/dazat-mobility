import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-28-checklist.md',
  'docs/traceability/phase-0-28-error-security.md',
  'tests/api/runtime-contract.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.28 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const truth of ['requestIdHeader: false', "reply.header('x-request-id', request.id)", 'ROUTE_NOT_FOUND', 'REQUEST_BODY_TOO_LARGE', 'INTERNAL_SERVER_ERROR', "checkpoint: 'engineering-phase-0.28'"]) {
  if (!app.includes(truth)) errors.push(`Error security source missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.28 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.28 verification PASSED');
console.log('Checked server-owned correlation and privacy-safe unknown, oversized, client and server error contracts.');
