# Phase 0.126 — Provider-disabled Finance contract

The PaymentStatusProjection contract now makes two current-environment invariants explicit at the type level: provider action is never attempted and blind retry is never permitted. The runtime service already enforces these values; this phase prevents callers from weakening the contract accidentally.
