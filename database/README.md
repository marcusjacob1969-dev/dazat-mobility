# Database foundation

The first deployment may use one PostgreSQL cluster, but logical schemas preserve domain ownership. Application modules must not treat shared database access as permission to mutate another domain's state.

Migrations 0001–0006 now carry the source foundation through atomic assignment, protected Journey start, active telemetry, restricted Safety signals and governed completion. They intentionally do **not** claim that the complete v0.4 logical model is implemented or that PostgreSQL/PostGIS execution has been verified in this workspace.
