# Engineering Phase 0.92 — Immutable API Image Base

Phase 0.92 strengthens the API image supply-chain boundary after Phase 0.91 container confinement.

The production API Dockerfile must pin both Node 24 Bookworm slim stages to an immutable SHA-256 digest. The source verifier rejects an unpinned Node base, requires the non-root `node` runtime user and retains the image healthcheck.

Hosted verification continues to build the repository Dockerfile itself, inspect the resulting runtime user, install locked workspace dependencies with lifecycle scripts disabled, and execute the existing verification chain.

This phase does not claim that a pinned digest makes the complete software supply chain trusted. Dependency provenance, vulnerability evidence, CI runner integrity and future base-image refreshes remain separate controls.