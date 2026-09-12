# Engineering Phase 0.96 — Executable Demo Truth

## Objective

Keep the repository's executable core-journey demonstration aligned with the current engineering checkpoint so automated evidence cannot quietly advertise an obsolete build state.

## Delivered

- Refresh `scripts/demo-core-journey.mjs` from the stale Phase 0.80 label to Phase 0.96.
- Extend `scripts/verify-current.mjs` through Phase 0.96.
- Add an executable Phase 0.96 verifier that rejects stale demo metadata and an incomplete current-checkpoint range.
- Preserve the existing provider-disabled safety assertions: no real payment attempt and no external provider contact.

## Verification boundary

This phase changes executable evidence metadata and verification coverage only. It does not claim production-provider activation, real-money charging, real-user pilot approval, or production readiness of the complete Rider-to-Driver-to-Control-Room journey.
