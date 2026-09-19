# Phase 0.127 — Finance database provider-state invariants

Phase 0.126 made provider-disabled Finance guarantees explicit in the TypeScript contract. Phase 0.127 closes the corresponding database gap.

The authoritative finance.payment_status_projection is a view over finance.payment_intent, so database integrity on payment_intent is the integrity boundary for the projection. The new trigger rejects inconsistent combinations such as:

- CREATED with provider references, reconciliation, approved charging eligibility, or an attempted provider action.
- provider references without provider_action_attempted = true.
- an attempted provider action without approved charging eligibility and both provider references.
- STATUS_UNKNOWN without reconciliation required.

The guard applies on insert and on updates to every provider-state field, not only status transitions. This prevents a same-status metadata update from bypassing the existing payment-status transition guard.

This phase does not enable charging or add a provider.