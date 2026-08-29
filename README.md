# DAZAT Mobility

Production engineering source created from the DAZAT Mobility Master Blueprint v0.4.

Current checkpoint: **Engineering Phase 0.4**.

The first server-authoritative Rider-to-Driver assignment slice is now represented in source:

`REGISTER → VERIFY CONTACT → SESSION → BOOKING → QUOTE → CONFIRM → READY_FOR_DISPATCH → HARD-FILTERED SEARCH → CONTROLLED OFFER → ATOMIC DRIVER_ASSIGNED`

Important Phase 0.4 safety/integrity rules:

- The backend owns identity, session, Booking and Pricing state.
- Raw contact verification codes and plaintext bearer session tokens are never persisted.
- A delivery-provider timeout is `UNKNOWN`, not fabricated certainty.
- Passkey/WebAuthn verification fails closed until a standards-compliant ceremony provider is configured.
- Booker, passenger and payer remain separate even in self-booking.
- Current GPS is not a mandatory pickup location.
- Production pricing is disabled until an approved tariff/policy is configured. The local development quote is explicitly non-commercial.
- Driver authentication is never operating eligibility.
- Compliance, authorised vehicle, vehicle capability, fresh location, availability and active-assignment checks are hard filters before ranking.
- Straight-line distance is provisional ranking context, never an invented road ETA.
- Driver offers are meaningful, expiring and non-punitive for ordinary decline/expiry.
- Assignment revalidates eligibility and uses locks plus unique constraints so two Drivers cannot win the same Booking.
- An exhausted hard-filter pool becomes explicit `NO_ELIGIBLE_DRIVER` rather than false searching.

See `BUILD_STATUS.md`, `docs/architecture/ADR-0004-dispatch-driver-eligibility-assignment.md`, and `docs/engineering/phase-0-4-checklist.md` for evidence and limitations.
