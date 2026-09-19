# Phase 0.130 — Authoritative payment capture timestamp

Receipts previously used provider_created_at as a fallback capture timestamp. Those are different business facts: a provider payment object can exist before capture.

This phase adds finance.payment.captured_at, backfills existing captured rows from the best available historical timestamp, and adds a database guard requiring captured_at for captured/refunded payment states while rejecting it for uncaptured states.

The receipt projection now reads captured_at directly.