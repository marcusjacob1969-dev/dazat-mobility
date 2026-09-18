# Phase 0.110 — Happy-path Rider/Driver state parity

The persisted PostgreSQL/HTTP Core Journey proof now checks the happy-path assignment boundary through both Rider and Driver HTTP projections.

After an eligible Driver is atomically assigned:

- Rider receives the canonical Core Journey projection.
- Driver receives the canonical Core Journey projection.
- Their milestone collections are identical.
- Their next action is identical.
- The existing booking status and DRIVER_ASSIGNED milestone assertions remain enforced.

The Control Room continues to use its separate task-scoped authority boundary; this phase does not introduce a new client authority or database editing path.

No real payment, external provider, communications or pilot execution is enabled.
