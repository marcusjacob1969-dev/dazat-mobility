import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'services/api/src/app.ts',
  'tests/api/runtime-contract.test.mjs',
  'docs/engineering/phase-0-25-checklist.md',
  'docs/traceability/phase-0-25-api-runtime-contract.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.25 file: ${path}`);

const app = readFileSync(join(root, required[0]), 'utf8');
for (const truth of [
  'export function buildApi',
  "app.get('/health/live'",
  "app.get('/health/ready'",
  "await database.query('SELECT 1')",
  "checkpoint: 'engineering-phase-0.25'",
  "status: 'NOT_READY'",
  'await database.end()'
]) if (!app.includes(truth)) errors.push(`API factory missing: ${truth}`);

const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
if (!main.includes('buildApi(config, { database })')) errors.push('Production entry point does not delegate to the API factory');
if (app.includes('.listen(')) errors.push('API factory must not open a network listener');

const test = readFileSync(join(root, required[1]), 'utf8');
for (const truth of ["'/health/live'", "'/health/ready'", "'/v1/build-info'", '503', "includes('credential')", 'closeCount()']) {
  if (!test.includes(truth)) errors.push(`Runtime contract test missing: ${truth}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.25 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.25 verification PASSED');
console.log('Checked testable API bootstrap, health contracts, privacy-minimised failure and lifecycle closure.');
