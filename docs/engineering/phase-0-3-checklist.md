# Phase 0.3 checkpoint checklist

- [x] Contact verification challenge model with expiry, resend and bounded attempts.
- [x] Raw verification code excluded from persistence.
- [x] Provider delivery is outside DB transaction and supports UNKNOWN outcome.
- [x] Successful verification activates pending account and creates verified-contact authenticator.
- [x] Opaque bearer session secret returned once; only hash stored.
- [x] Session validation and revocation boundary.
- [x] Passkey path fails closed until a verified WebAuthn adapter exists.
- [x] Authenticated Rider self-booking creates separate BOOKER/PASSENGER/PAYER roles.
- [x] Explicit pickup/drop-off snapshots; GPS is not forced.
- [x] Quote and FareAgreement persistence under Pricing ownership.
- [x] Development pricing is environment-configured and explicitly non-commercial.
- [x] Booking transition spine reaches READY_FOR_DISPATCH without inventing a driver.
- [ ] PostgreSQL/PostGIS migration executed in a real local/CI database.
- [ ] Fastify API compiled and integration-tested with installed dependencies.
- [ ] Expo Rider/Driver apps compiled and exercised against the API.
- [ ] Real email/SMS verification provider selected and tested.
- [ ] Standards-compliant WebAuthn/passkey ceremony provider installed and verified.
