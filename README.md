# DAZAT Mobility

Production engineering source created from the DAZAT Mobility Master Blueprint v0.4.

Current checkpoint: **Engineering Phase 0.3**.

The first server-authoritative Rider slice is now represented in source:

`REGISTER → VERIFY CONTACT → SESSION → DRAFT BOOKING → QUOTE → AWAITING_CONFIRMATION → CONFIRMED → READY_FOR_DISPATCH`

Important Phase 0.3 safety/integrity rules:

- The backend owns identity, session, Booking and Pricing state.
- Raw contact verification codes and plaintext bearer session tokens are never persisted.
- A delivery-provider timeout is `UNKNOWN`, not fabricated certainty.
- Passkey/WebAuthn verification fails closed until a standards-compliant ceremony provider is configured.
- Booker, passenger and payer remain separate even in self-booking.
- Current GPS is not a mandatory pickup location.
- Production pricing is disabled until an approved tariff/policy is configured. The local development quote is explicitly non-commercial.
- Phase 0.3 stops at `READY_FOR_DISPATCH`; it does not invent Driver matching or assignment.

See `BUILD_STATUS.md`, `docs/architecture/ADR-0003-verified-session-booking-slice.md`, and `docs/engineering/phase-0-3-checklist.md` for evidence and limitations.
