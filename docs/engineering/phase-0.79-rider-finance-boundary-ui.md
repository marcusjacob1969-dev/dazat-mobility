# Engineering Phase 0.79 — Rider Finance Boundary Contract and UI

The provider-disabled Finance result is now consistent across the server contract, OpenAPI and Rider application.

After PaymentIntent preparation, the Rider client reads Payment status and canonical journey progress together. The progress surface therefore moves from the generic Finance step to `PAYMENT_PROVIDER_UNAVAILABLE` immediately and displays that no charge was attempted. OpenAPI includes the same closed action value.

This checkpoint does not enable charging, select a provider, create a receipt or infer payment success.
