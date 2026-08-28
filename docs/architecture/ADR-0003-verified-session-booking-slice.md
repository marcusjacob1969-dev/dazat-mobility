# ADR-0003 — Verified contact, revocable session and first Rider Booking slice

Status: **Accepted for Engineering Phase 0.3**  
Implementation evidence: **source/static/domain-test evidence only; database/API/mobile runtime integration not yet executed in this environment**.

## Decision

1. Account registration remains `PENDING` until a typed ContactPoint is actually verified.
2. Short verification codes are generated server-side, stored only as salted HMAC verifier material, expire quickly and have bounded attempts. Raw codes are never persisted.
3. Delivery happens after the verification transaction commits. A provider timeout becomes `UNKNOWN`, not a fabricated delivery failure or success.
4. Successful verification may activate a pending account and create a revocable opaque session. Only the SHA-256 session-token hash is stored; the bearer secret is returned once.
5. Device trust remains optional evidence. Verification does not automatically create a `TRUSTED` device.
6. Passkey/WebAuthn remains the preferred strong authenticator path, but Phase 0.3 refuses to fake cryptographic ceremony verification. The API fails closed until a standards-compliant ceremony adapter is installed and evidenced.
7. The first Rider vertical slice is server-authoritative: authenticated Rider creates a `DRAFT` Booking, receives a Quote, confirms it, and reaches `READY_FOR_DISPATCH` for immediate travel.
8. Booker, passenger and payer are persisted as separate BookingParty roles even in the simple self-booking case.
9. Phase 0.3 contains no approved live fare. The only runnable pricing adapter is an explicitly non-commercial environment-configured development fixture; production pricing defaults to disabled.
10. Quote/FareAgreement live in Pricing ownership. Booking state transitions remain Booking-owned and are guarded by the canonical transition model.

## Consequences

- The platform now has a real authentication/session boundary without claiming production passkey verification.
- A Rider client cannot set authoritative Booking state or price.
- We can exercise the account-to-dispatch-readiness spine before implementing maps, Dispatch, Journey or Payments.
- Cross-domain Pricing/Booking operations can have partial outcomes; reconciliation remains required rather than using distributed transactions.
