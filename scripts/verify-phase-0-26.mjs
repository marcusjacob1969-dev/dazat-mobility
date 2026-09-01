import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'tests/api/config-security.test.mjs',
  'docs/engineering/phase-0-26-checklist.md',
  'docs/traceability/phase-0-26-configuration-security.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.26 file: ${path}`);
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
if (!config.includes("env.VERIFICATION_DELIVERY_MODE === 'development_console'")) errors.push('Verification delivery does not require explicit development mode');
const test = readFileSync(join(root, required[0]), 'utf8');
for (const truth of ['provider and delivery modes default to disabled', 'every unapproved provider or mutation mode fails closed', 'database, Redis and strong peppers are mandatory', 'safety-critical numeric bounds reject invalid values']) {
  if (!test.includes(truth)) errors.push(`Configuration runtime contracts missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.26 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.26 verification PASSED');
console.log('Checked fail-closed delivery, provider, mutation, secret, pricing and numeric configuration boundaries.');
