# Phase 0.122 — Finance mutation authorization isolation

The HTTP PostgreSQL verifier now proves that authenticated users outside the booking's payer authority cannot prepare a PaymentIntent for that booking.

Both an unrelated Rider session and a Control Room operator session receive `403 FINANCE_FORBIDDEN`. This keeps Finance mutations payer-scoped and prevents authentication alone, operational role, or unrelated Rider access from becoming payment authority.
