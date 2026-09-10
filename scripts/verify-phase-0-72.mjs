import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  '/v1/identity/registrations', 'phase-072-register-rider', '/v1/identity/verifications/contact',
  '/v1/identity/verifications/contact/confirm', 'developmentCode', 'registeredToken', '/v1/identity/session',
  "method: 'DELETE'", 'SESSION_INVALID', "VERIFICATION_DELIVERY_MODE: 'development_console'"
]) if (!runner.includes(truth)) errors.push(`Registration-to-Booking verifier missing: ${truth}`);
if (!app.includes("checkpoint: 'engineering-phase-0.72'")) errors.push('Build metadata is not at Phase 0.72');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.72 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.72 verification PASSED');
