# Engineering Phase 0.93 — Container Registry Resilience

## Objective

Make the hosted API-container verification resilient to transient container-registry transport failures without weakening image immutability.

## Delivered

- Keep the PostGIS verification image digest-pinned.
- Explicitly pull the exact pinned image before starting the smoke-test database.
- Retry the pull with a bounded five-attempt loop.
- Fail closed after the bounded retry budget is exhausted.
- Add an executable Phase 0.93 verifier for the workflow contract.
- Preserve the existing non-root, read-only, capability-drop and no-new-privileges API runtime checks.

## Verification boundary

This phase addresses transient registry transport failures only. It does not claim registry availability, provenance, signing, or complete software supply-chain trust.
