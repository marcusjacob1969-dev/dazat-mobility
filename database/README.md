# Database foundation

The first deployment may use one PostgreSQL cluster, but logical schemas preserve domain ownership. Application modules must not treat shared database access as permission to mutate another domain's state.

Migrations 0001–0020 carry the source foundation through the completed Organisation Engine closure. They intentionally do **not** claim PostgreSQL/PostGIS execution has been verified in this workspace. When a freshly provisioned disposable PostgreSQL/PostGIS database is available, run `DATABASE_URL=... DAZAT_MIGRATION_VALIDATION_TARGET=ephemeral npm run verify:migrations:postgres`; the target database name must begin `dazat_migration_verify_`.
