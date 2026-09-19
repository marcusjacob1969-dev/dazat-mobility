# Phase 0.125 — Captured payment projection boundary

The HTTP integration proof now checks a captured PaymentIntent through the authoritative payment-status projection. The proof confirms the captured amount/currency, payer isolation, no provider action in the provider-disabled environment, no reconciliation requirement for the known captured state, and no blind retry.
