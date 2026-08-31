# Engineering Phase 0.21 checklist

## Source foundation completed

- [x] Add one reproducible PostgreSQL migration-chain runner for migrations 0001–0020.
- [x] Fail closed unless the caller explicitly declares an ephemeral validation target.
- [x] Require a `dazat_migration_verify_*` database name and verify the active connection before migration execution.
- [x] Use `psql` with `ON_ERROR_STOP`, no user startup configuration and ordered migration filenames.
- [x] Verify representative canonical relations after the chain completes.
- [x] Ensure the runner cannot create, drop or empty a database.
- [x] Add a source verifier and executable guard tests.

## Run when disposable PostgreSQL/PostGIS is available

```bash
export DATABASE_URL='postgresql://dazat:password@localhost:5432/dazat_migration_verify_ci'
export DAZAT_MIGRATION_VALIDATION_TARGET=ephemeral
npm run verify:migrations:postgres
```

The target must be freshly provisioned and disposable. This command intentionally refuses ordinary development or production database names.

## Deliberately not claimed

- [ ] PostgreSQL/PostGIS chain execution in this workspace (client/runtime unavailable).
- [ ] Transaction and concurrency behaviour against a real database.
- [ ] Fastify, Vite or Expo dependency-backed runtime execution.
- [ ] Provider, staff or institutional operational mutation enablement.
