# Phase 0.131 — Payment/PaymentIntent Consistency

Phase 0.131 closes a database integrity gap in the Finance vertical slice.

The database now enforces that a finance.payment remains bounded by its authoritative finance.payment_intent: currency must match; authorised and captured amounts cannot exceed the intent; refunds cannot exceed capture; captured/refunded states require coherent positive values; REFUNDED requires full refund of the captured amount; and a CREATED PaymentIntent cannot have a captured Payment.

These rules are enforced by PostgreSQL triggers and therefore apply independently of the HTTP/API path. Provider charging remains disabled; this phase adds integrity constraints only.
