# Engineering Phase 0.95 — Build Information Freshness

## Objective

Keep the public API build-information endpoint aligned with the repository's current engineering checkpoint and avoid advertising stale implementation claims.

## Delivered

- Refresh `/v1/build-info` to Engineering Phase 0.95.
- Replace the stale Phase 0.91 implementation label with a concise verified-status statement.
- Keep provider and operational mutations explicitly disabled.
- Add an executable verifier that rejects the stale checkpoint and requires the Phase 0.95 metadata contract.

## Verification boundary

This phase corrects release metadata only. It does not claim that production providers are enabled, that a real-user pilot is approved, or that the complete Rider-to-Driver-to-Control-Room vertical slice is production-ready.
