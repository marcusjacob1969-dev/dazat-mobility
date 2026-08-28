# Engineering Phase 0.3 — Blueprint traceability

| Blueprint concern | Phase 0.3 implementation evidence | Status |
|---|---|---|
| Person / UserAccount / RiderProfile remain separate | Existing 0.2 schema + authenticated principal resolution | SOURCE_CREATED |
| Contact verification state separate from ContactPoint | `identity.verification_record` challenge lifecycle | SOURCE_CREATED |
| Sessions independently revocable | hashed opaque `identity.session` bearer boundary + revoke route | SOURCE_CREATED |
| Device trust is context, not identity proof | optional RECOGNISED DeviceTrustRecord on verified session | SOURCE_CREATED |
| Passkeys preferred; do not invent crypto | provider-neutral ceremony port + fail-closed route | PARTIAL — PROVIDER ADAPTER NOT YET VERIFIED |
| Backend owns Booking state | Booking service uses canonical transition guard | SOURCE_CREATED |
| Booker / passenger / payer distinct | three BookingParty records for self-booking | SOURCE_CREATED |
| Pickup not forced to current GPS | client supplies explicit pickup LocationInput; backend snapshots it | SOURCE_CREATED |
| Pricing versioned and separate from Booking | Pricing Quote + FareAgreement tables/outbox | SOURCE_CREATED |
| No unapproved commercial fare | production pricing disabled; dev fixture explicitly non-commercial | SOURCE_CREATED |
| Immediate confirmed Booking becomes READY_FOR_DISPATCH | first Rider vertical slice | SOURCE_CREATED |
| Provider timeout does not manufacture certainty | verification delivery `UNKNOWN` outcome | SOURCE_CREATED |
| Idempotent command boundaries | Booking/Pricing command deduplication | SOURCE_CREATED |
| Transactional outbox | Identity, Booking and Pricing outbox records | SOURCE_CREATED |

## Evidence limitation

Phase 0.3 has domain compilation/tests plus static source verification in this environment. PostgreSQL/PostGIS migrations, Fastify runtime, Expo runtime, real email/SMS delivery and a standards-compliant WebAuthn provider have **not** been runtime-verified here and must remain unverified until executed in a suitable development environment.
