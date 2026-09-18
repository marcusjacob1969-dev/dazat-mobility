# Phase 0.112 — Rider canonical receipt surface

The Rider surface now exposes the existing canonical Finance receipt read path after Journey completion.

- Rider binds `ReceiptProjection` to the existing Finance API client.
- The screen can request receipt availability for the current Booking.
- A captured Payment is rendered from the canonical receipt projection.
- The UI explicitly distinguishes receipt readiness from provider-disabled PaymentIntent preparation.
- No client-side payment state machine or receipt fabrication is introduced.

The backend remains authoritative: a receipt is available only when a captured Payment exists. Provider-disabled PaymentIntents do not create a receipt.

No real payment provider, real money movement, external communications, or pilot execution is enabled.
