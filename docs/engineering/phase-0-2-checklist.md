# Engineering Phase 0.2 Checklist — Identity & Account Foundation

- [x] Preserve Person / UserAccount / RiderProfile / DriverProfile separation.
- [x] Add typed ContactPoint and separate VerificationRecord model.
- [x] Add passkey-ready Authenticator persistence without private-key storage.
- [x] Add DeviceTrustRecord.
- [x] Add independently revocable Session model using token hash/reference boundary.
- [x] Add explicit AccountRecoveryCase states.
- [x] Add append-only account lifecycle transition history.
- [x] Add identity idempotency store and transactional outbox.
- [x] Implement idempotent `POST /v1/identity/registrations` source.
- [x] Keep new accounts PENDING until contact/authentication verification.
- [x] Wire Rider Create Account screen to registration API.
- [x] Wire Driver Start Application screen to registration API without implying work eligibility.
- [x] Add passkey ceremony adapter boundary; do not write custom cryptography.
- [x] Add identity domain tests.
- [x] Add Phase 0.2 static verification.
- [ ] Execute migrations against a real PostgreSQL/PostGIS instance.
- [ ] Run API integration tests against PostgreSQL.
- [ ] Select/wire email/SMS verification provider(s).
- [ ] Implement standards-compliant WebAuthn/passkey registration and authentication ceremonies.
- [ ] Implement signed/opaque session issuance and server-side revocation enforcement.
- [ ] Integrate DAZAT Shield risk decisions / step-up actions.

Unchecked items are intentionally **not** represented as implemented.
