import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0002_identity_account_foundation.sql',
  'packages/domain/src/identity.ts',
  'packages/contracts/src/identity.ts',
  'services/api/src/modules/identity/registration-service.ts',
  'services/api/src/modules/identity/routes.ts',
  'services/api/src/modules/identity/authentication-port.ts',
  'apps/rider/src/identity-api.ts',
  'apps/driver/src/identity-api.ts',
  'docs/architecture/ADR-0002-identity-account-foundation.md',
  'docs/traceability/identity-account-requirements.md'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.2 file: ${rel}`);

const sql = readFileSync(join(root, 'database/migrations/0002_identity_account_foundation.sql'), 'utf8');
const foundationSql = readFileSync(join(root, 'database/migrations/0001_foundation.sql'), 'utf8');
const identitySql = `${foundationSql}\n${sql}`;
for (const table of [
  'identity.person_name',
  'identity.contact_point',
  'identity.verification_record',
  'identity.authenticator',
  'identity.device_trust_record',
  'identity.session',
  'identity.account_recovery_case',
  'identity.account_status_transition',
  'identity.command_deduplication',
  'identity.outbox_message'
]) {
  if (!sql.includes(table)) errors.push(`Missing identity persistence object: ${table}`);
}
for (const word of ['PASSKEY','ACTIVE','LIMITED','SUSPENDED','CLOSED','STEP_UP_REQUIRED','RECOVERY_COMPLETE']) {
  if (!identitySql.includes(`'${word}'`)) errors.push(`Missing identity/security state: ${word}`);
}
if (!sql.includes('credential_public_key')) errors.push('Passkey verifier/public-key storage is not modelled');
if (!sql.includes('session_token_hash')) errors.push('Session token hash/reference boundary is not modelled');
if (!sql.includes('identity.prevent_immutable_mutation')) errors.push('Account lifecycle append-only transition guard missing');
if (!sql.includes('identity.outbox_message')) errors.push('Identity transactional outbox missing');

const service = readFileSync(join(root, 'services/api/src/modules/identity/registration-service.ts'), 'utf8');
if (!service.includes("accountStatus: 'PENDING'")) errors.push('Registration must not silently activate an unverified account');
if (!service.includes("nextAction: 'CONTACT_VERIFICATION_REQUIRED'")) errors.push('Registration must require contact verification next');
if (!service.includes("'identity.account.registration_started'")) errors.push('Registration event missing');
if (service.includes('request.contact.value\n      })')) errors.push('Raw registration contact may be leaking into event payload');

const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
if (!rider.includes("profileKind: 'RIDER'")) errors.push('Rider app is not wired to Rider registration');
if (!driver.includes("profileKind: 'DRIVER'")) errors.push('Driver app is not wired to Driver registration');
if (!driver.includes('does not make a driver eligible')) errors.push('Driver registration UI must not imply operating eligibility');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.2 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.2 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus identity persistence, passkey/session boundaries, account-state truth and mobile registration wiring.`);
