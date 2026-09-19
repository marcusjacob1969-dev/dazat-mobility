# Phase 0.121 — Provider-disabled Finance boundary

This checkpoint makes the provider-disabled Finance boundary explicit in executable source verification.

The Finance HTTP surface exposes PaymentIntent preparation and read-only payment/receipt/earnings reads, but no public capture, charge, or refund route. Payment preparation remains `CREATED`, `NOT_ELIGIBLE`, and `providerActionAttempted: false`, with `productionChargingEnabled: false`.

The existing database-backed HTTP verifier already proves the runtime payment state remains provider-disabled after preparation and replay. This checkpoint adds a source-level guard against accidentally introducing a direct provider-action endpoint or weakening the no-charge invariant.
