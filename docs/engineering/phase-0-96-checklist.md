# Engineering Phase 0.96 — Runtime build-info contract

## Objective

Make the API build metadata correction executable at the runtime-test boundary, so source metadata and the compiled API contract cannot silently diverge.

## Scope

- Keep `/v1/build-info` independent of database availability.
- Assert the current Engineering Phase 0.95 checkpoint at runtime.
- Assert the product identity and provider-disabled implementation status.
- Remove the stale Phase 0.91 expectation from the runtime contract.
- Add a dedicated Phase 0.96 source verifier.
- Include Phase 0.96 in the canonical current-checkpoint verification chain.

## Safety boundary

This phase changes verification truth only. It does not enable payments, communications, telephony, operational providers, or real-user actions.

## Verification

The runtime contract is exercised by the existing API runtime test command after the API is compiled. The dedicated verifier additionally prevents regression to stale checkpoint metadata.

## Explicit non-claims

Passing this phase does not claim production deployment readiness, provider approval, supply-chain completeness, or successful real-money operation.
