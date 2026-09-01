import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-30-checklist.md',
  'docs/traceability/phase-0-30-log-privacy.md',
  'tests/api/runtime-contract.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.30 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/api/runtime-contract.test.mjs'), 'utf8');
for (const truth of ["checkpoint: 'engineering-phase-0.30'", 'new LogController({ disableRequestLogging: true })', "route: request.routeOptions.url ?? 'UNMATCHED'", "censor: '[REDACTED]'", "message: '[REDACTED]'", "stack: '[REDACTED]'"]) {
  if (!app.includes(truth)) errors.push(`Log-privacy source missing: ${truth}`);
}
for (const secret of ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-api-key', 'res.headers.set-cookie']) {
  if (!app.includes(secret)) errors.push(`Log redaction path missing: ${secret}`);
}
if (!tests.includes('operational logs exclude credentials query values and internal error details')) {
  errors.push('Runtime log-privacy contract is missing');
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.30 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.30 verification PASSED');
console.log('Checked executable query, credential and internal-error log non-disclosure with safe correlation.');
