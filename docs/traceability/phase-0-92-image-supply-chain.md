# Phase 0.92 — Image Supply-Chain Traceability

## Requirement

The packaged API runtime must not silently change its operating-system/runtime base through a mutable container tag.

## Evidence

- Both API Dockerfile stages pin `node:24-bookworm-slim` by immutable SHA-256 digest.
- The runtime image remains explicitly non-root through `USER node`.
- The runtime healthcheck remains present.
- Hosted verification builds the repository Dockerfile and inspects the resulting image configuration.
- Locked dependency installation remains `npm ci --ignore-scripts`.
- The Phase 0.92 verifier rejects an unpinned Node base.

## Boundary

Digest pinning establishes reproducible base-image selection; it does not independently establish that the selected image is vulnerability-free, authentic beyond the registry's digest identity, or suitable indefinitely. Dependency and CI security evidence remain separately governed.