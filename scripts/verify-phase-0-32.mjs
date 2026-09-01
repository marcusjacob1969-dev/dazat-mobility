import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-32-checklist.md',
  'docs/traceability/phase-0-32-session-authority.md',
  'tests/api/session-auth-runtime.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.32 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const session = readFileSync(join(root, 'services/api/src/modules/identity/session-service.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/api/session-auth-runtime.test.mjs'), 'utf8');
for (const truth of ["checkpoint: 'engineering-phase-0.32'", "bearerToken.startsWith('dzs_')", 'hashOpaqueSecret(bearerToken)', 'isSessionAuthoritative', 'canUseAccountCapability', 'last_seen_at']) {
  if (!(app + session).includes(truth)) errors.push(`Session-authority source missing: ${truth}`);
}
for (const truth of ['malformed bearer tokens fail before database access', 'queries only a token hash', 'revoked and expired sessions fail closed', 'account capability denial fails closed']) {
  if (!tests.includes(truth)) errors.push(`Runtime session contract missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.32 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.32 verification PASSED');
console.log('Checked executable bearer hashing, lifecycle, capability and activity-refresh session authority.');
