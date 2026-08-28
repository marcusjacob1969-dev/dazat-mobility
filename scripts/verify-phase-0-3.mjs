import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0003_verified_auth_session_booking_slice.sql',
  'packages/domain/src/authentication.ts',
  'packages/domain/src/pricing.ts',
  'services/api/src/security/secret-utils.ts',
  'services/api/src/modules/identity/contact-verification-service.ts',
  'services/api/src/modules/identity/session-service.ts',
  'services/api/src/modules/identity/verification-delivery-port.ts',
  'services/api/src/modules/booking/booking-service.ts',
  'services/api/src/modules/booking/development-pricing-adapter.ts',
  'services/api/src/modules/booking/routes.ts',
  'apps/rider/src/booking-api.ts',
  'docs/architecture/ADR-0003-verified-session-booking-slice.md',
  'docs/traceability/phase-0-3-requirements.md'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.3 file: ${rel}`);

const sql = readFileSync(join(root, 'database/migrations/0003_verified_auth_session_booking_slice.sql'), 'utf8');
for (const object of [
  'challenge_hash', 'attempt_count', 'max_attempts', 'pricing.quote', 'pricing.fare_agreement',
  'pricing.command_deduplication', 'pricing.outbox_message', 'identity_session_token_hash_idx'
]) {
  if (!sql.includes(object)) errors.push(`Missing Phase 0.3 persistence/security object: ${object}`);
}
if (!sql.includes('raw verification codes are never stored')) errors.push('Verification secret non-storage rule missing from migration');
if (!sql.includes('intentionally has no cross-domain foreign key')) errors.push('Pricing cross-domain ownership comment missing');

const verification = readFileSync(join(root, 'services/api/src/modules/identity/contact-verification-service.ts'), 'utf8');
if (!verification.includes('hashVerificationCode')) errors.push('Contact verification code is not one-way verified');
if (!verification.includes("status = 'VERIFIED'")) errors.push('Verified contact state is not persisted');
if (!verification.includes("'VERIFIED_CONTACT'")) errors.push('Verified contact authenticator/session strength missing');
if (!verification.includes("'identity.contact.verified'")) errors.push('Verified-contact event missing');
if (!verification.includes("deliveryState = 'UNKNOWN'")) errors.push('Provider delivery UNKNOWN semantics missing');
if (verification.includes('challenge_hash, code')) errors.push('Raw verification code appears to be persisted');

const secrets = readFileSync(join(root, 'services/api/src/security/secret-utils.ts'), 'utf8');
if (!secrets.includes("randomBytes(32)")) errors.push('Opaque session secret lacks a 32-byte random source');
if (!secrets.includes("createHash('sha256')")) errors.push('Opaque session secret hash missing');
if (!secrets.includes('timingSafeEqual')) errors.push('Verification hash comparison is not constant-time');

const session = readFileSync(join(root, 'services/api/src/modules/identity/session-service.ts'), 'utf8');
if (!session.includes('session_token_hash')) errors.push('Session service does not persist/resolve token hashes');
if (!session.includes('isSessionAuthoritative')) errors.push('Session authority domain guard missing');
if (!session.includes('canUseAccountCapability')) errors.push('Session capability gate missing');

const booking = readFileSync(join(root, 'services/api/src/modules/booking/booking-service.ts'), 'utf8');
for (const expected of ["'DRAFT'", "'QUOTE_CREATED'", "'AWAITING_CONFIRMATION'", "'CONFIRMED'", "'READY_FOR_DISPATCH'"]) {
  if (!booking.includes(expected)) errors.push(`First Rider slice missing Booking state ${expected}`);
}
if (!booking.includes("for (const role of ['BOOKER', 'PASSENGER', 'PAYER']")) errors.push('Self-booking party separation missing');
if (!booking.includes("source)\n         VALUES ($1, $2, $3::jsonb, 'BOOKER')")) errors.push('Client cannot author arbitrary BookingRequirement source');
if (!booking.includes('assertCanonicalForwardTransition')) errors.push('Booking server transition guard missing');
if (!booking.includes('PricingPort')) errors.push('Pricing provider/policy abstraction missing');

const pricing = readFileSync(join(root, 'services/api/src/modules/booking/development-pricing-adapter.ts'), 'utf8');
if (!pricing.includes('DEVELOPMENT_FIXTURE_V0.3_NON_COMMERCIAL')) errors.push('Development quote is not explicitly non-commercial');
if (!pricing.includes('PricingNotConfiguredError')) errors.push('Production pricing fail-closed path missing');

const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
for (const step of ['startRiderContactVerification', 'confirmRiderContactVerification', 'createRiderBooking', 'quoteRiderBooking', 'confirmRiderBooking']) {
  if (!rider.includes(step)) errors.push(`Rider vertical slice is not wired to ${step}`);
}
if (!rider.includes('No driver has been invented or assigned')) errors.push('Rider UI must not imply Dispatch exists in Phase 0.3');

const identityRoutes = readFileSync(join(root, 'services/api/src/modules/identity/routes.ts'), 'utf8');
if (!identityRoutes.includes('PASSKEY_CEREMONY_PROVIDER_NOT_CONFIGURED')) errors.push('Passkey route must fail closed rather than fake WebAuthn verification');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.3 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.3 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus verification secrecy, session authority, fail-closed passkeys, Booking ownership/state and non-commercial quote controls.`);
