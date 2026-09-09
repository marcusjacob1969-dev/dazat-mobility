# Engineering Phase 0.69 — PostgreSQL core-journey query verification

Hosted CI now goes beyond applying migrations: it compiles the API and executes the real Rider, Driver and task-scoped Control Room core-journey reads against the freshly migrated disposable PostGIS database.

Reserved UUIDs intentionally return the privacy-safe not-found outcome. Any missing table, column, enum, operator or invalid SQL instead fails the job as schema/query incompatibility. The verifier refuses to run unless the migration target is explicitly marked ephemeral.

The disposable database password is derived from the unique GitHub run ID rather than a repository-stored static value.
