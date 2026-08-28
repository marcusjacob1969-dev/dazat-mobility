# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.3 — Verified Authentication/Session Boundary + First Account-to-Booking Slice**

Git baseline started from scratch from the DAZAT Mobility Master Blueprint v0.4.

### Implemented source

- Production monorepo skeleton: Rider, Driver, Control Room, API, workers, shared packages.
- PostgreSQL/PostGIS canonical domain schemas and transactional outboxes.
- Person / UserAccount / RiderProfile / DriverProfile separation.
- Contact verification challenge lifecycle with expiry, resend cooldown and attempt limits.
- Raw verification codes are not persisted; one-way HMAC verifier material is stored.
- Verified contact can activate pending account and create a revocable opaque bearer session.
- Only session-token hashes are persisted; session secrets are returned once.
- Optional DeviceTrustRecord is evidence/context only and is not automatically TRUSTED.
- Passkey/WebAuthn boundary fails closed until a standards-compliant ceremony adapter is configured.
- Authenticated Rider self-booking creates separate BOOKER / PASSENGER / PAYER party records.
- Explicit pickup/drop-off snapshots; current GPS is not required.
- Pricing Quote and FareAgreement ownership added.
- Production pricing defaults to disabled; Phase 0.3 development quote is explicitly non-commercial and environment-configured.
- First Rider vertical slice reaches `READY_FOR_DISPATCH` for an immediate confirmed booking without inventing a driver.
- Rider Phase 0.3 UI wires registration → verification → session → Booking → Quote → confirmation.
- Driver Phase 0.3 UI wires registration → verification → authenticated account while preserving separate operating eligibility.

### Verification status

- Core TypeScript domain/contracts/design-system compilation: **available**.
- Domain tests: **available**.
- Phase 0.3 static/security verification: **available**.
- PostgreSQL/PostGIS migration runtime: **NOT EXECUTED in this environment**.
- Fastify API dependency install/runtime integration: **NOT EXECUTED in this environment**.
- Expo Rider/Driver runtime: **NOT EXECUTED in this environment**.
- Real email/SMS verification delivery: **NOT CONFIGURED**.
- WebAuthn/passkey cryptographic ceremony adapter: **NOT CONFIGURED; fails closed**.
- Production pricing: **NOT CONFIGURED; fails closed**.

## Next checkpoint

**Engineering Phase 0.4 — Dispatch Foundation + Driver Availability/Eligibility Boundary**

Planned spine: verified Driver session → compliance/vehicle eligibility snapshot → online availability → DispatchAttempt → controlled DriverOffer → atomic DriverAssignment → Rider/Driver assignment projections.
