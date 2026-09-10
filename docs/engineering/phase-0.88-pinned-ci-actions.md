# Engineering Phase 0.88 — Pinned CI Action Revisions

Every GitHub Action dependency in the hosted verification workflow is now pinned to an exact commit revision. Checkout, Node setup and artifact retention can no longer change silently when an upstream major-version tag moves.

The revisions were resolved from the maintainers' current v4 Git references and then exercised by the complete DAZAT container, PostGIS, SBOM, vulnerability, compilation and acceptance gates. Human review can still identify the action family from its repository name.

Commit pinning reduces workflow supply-chain drift. Future security and feature updates remain deliberate repository changes that must pass the same hosted gates.
