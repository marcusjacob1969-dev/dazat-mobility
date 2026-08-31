# Phase 0.22 CI migration verification traceability

| Engineering invariant | Source implementation | Status |
|---|---|---|
| Every pull request can obtain fresh PostGIS migration evidence | GitHub Actions workflow with a disposable PostGIS 16 service | SOURCE_CREATED |
| CI target satisfies the runner's destructive-target controls | `dazat_migration_verify_ci` and explicit `ephemeral` environment | SOURCE_TESTED |
| No node package installation is required for schema execution | workflow calls only Node built-ins and `psql` | SOURCE_TESTED |
| Workspace compilation uses a locked dependency graph | committed lockfile and `npm ci --ignore-scripts` CI job | SOURCE_TESTED |
| The full 0001–0020 chain is exercised before merge | `verify-postgres-migrations.mjs` CI step | CONFIGURED_NOT_EXECUTED |
