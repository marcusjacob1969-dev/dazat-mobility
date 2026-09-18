# Phase 0.117 — Payment idempotency conflict proof

The completed-Journey HTTP verifier now proves that reusing a PaymentIntent idempotency key with a different request payload is rejected with `IDEMPOTENCY_KEY_REUSED`.

The original identical replay remains successful and returns the same persisted response.