# Phase 0.21 runtime-readiness traceability

| Engineering invariant | Source implementation | Status |
|---|---|---|
| Migration execution cannot target an ordinary database by accident | explicit `ephemeral` confirmation and database-name allowlist | SOURCE_TESTED |
| Every migration is applied in lexical 0001–0020 order | guarded runner inventory and loop | SOURCE_TESTED |
| SQL stops at first error and ignores local psql startup configuration | `psql --no-psqlrc` plus `ON_ERROR_STOP=1` | SOURCE_TESTED |
| Connected target is verified before write activity | `SELECT current_database()` equality guard | SOURCE_TESTED |
| Canonical cross-domain schema presence is checked after execution | `to_regclass` checks for Identity, Booking, Journey, Finance, Communications and Organisation | SOURCE_TESTED |
| Runner cannot provision or destroy a database | source guard tests and ADR | SOURCE_TESTED |
| Real PostgreSQL/PostGIS execution evidence | disposable runtime not available in this workspace | NOT_EXECUTED |
