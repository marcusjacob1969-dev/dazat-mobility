# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.2 — Identity & Account Foundation**  
Status: **SOURCE IMPLEMENTED / CORE DOMAIN TESTED / DATABASE & PROVIDER INTEGRATION NOT YET VERIFIED**

DAZAT is being built cleanly from the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository.

## Implemented in source

- Monorepo foundation for Rider, Driver, Control Room, API, workers and shared packages.
- PostgreSQL/PostGIS domain schema boundaries and canonical Booking foundation.
- Transactional outbox and append-only Booking transition history.
- Person / UserAccount / RiderProfile / DriverProfile separation.
- Preferred-name history and typed ContactPoint model.
- Separate contact verification records and contact permissions.
- Passkey-ready Authenticator record storing verifier/public metadata only.
- DeviceTrustRecord and independently revocable Session model.
- Explicit AccountRecoveryCase states and account lifecycle transition history.
- LIMITED account capability policy preserving essential safety/journey/support access while blocking risky changes.
- Idempotent identity registration transaction creating PENDING accounts only.
- Rider Create Account screen wired to the registration API.
- Driver Start Application screen wired to the same canonical Identity service while retaining separate driver compliance/eligibility truth.
- Provider-neutral passkey ceremony adapter boundary.

## Verified in this checkpoint

- TypeScript build for domain/contracts/design-system packages.
- Canonical identity/account state vocabulary.
- Account lifecycle transition guard.
- Limited Account Mode capability rules.
- Email/mobile normalisation and masking rules.
- E.164 registration phone validation.
- Rider + Driver dual-profile semantics.
- Recovery state-machine transitions.
- Session authority requires ACTIVE + unexpired.
- Static persistence/security checks for passkey/session boundaries and registration truthfulness.

## Not yet verified / deliberately not claimed

- PostgreSQL migrations have not been executed in this tool environment because no PostgreSQL/Docker runtime is available here.
- API runtime compilation/integration awaits installed workspace dependencies and a database runtime.
- Email/SMS verification is not wired.
- WebAuthn/passkey ceremonies are not yet implemented; only the secure model/adapter boundary exists.
- Authenticated bearer sessions are not yet issued.
- DAZAT Shield step-up / suspicious-session runtime integration is not yet wired.
- Driver registration is not driver approval or online eligibility.
- Booking creation remains the next vertical-slice build.

## Next checkpoint

**Engineering Phase 0.3 — Verified Authentication & Session Boundary + First Account-to-Booking Slice**

Target: contact verification adapter, passkey ceremony implementation/adapter, session issuance/revocation enforcement, then authenticated Rider Profile -> Create Booking -> Quote placeholder -> Confirm -> READY_FOR_DISPATCH using the canonical Booking engine.
