# ADR-0021: Guarded PostgreSQL migration-chain validation

- Status: Accepted for engineering readiness
- Date: 2026-08-31
- Engineering checkpoint: Phase 0.21

## Decision

The complete 0001–0020 SQL chain is executed only by `npm run verify:migrations:postgres` against a deliberately provisioned disposable PostgreSQL/PostGIS database. The command requires both `DAZAT_MIGRATION_VALIDATION_TARGET=ephemeral` and a database name matching `dazat_migration_verify_*`. It first confirms the connected database name, invokes `psql` without user startup configuration and with stop-on-error enabled, applies every ordered migration, then asserts representative canonical relations across Identity, Booking, Journey, Finance, Communications and Organisation domains.

The runner never creates, drops or empties a database. Provisioning and disposal remain an explicit CI/local-environment responsibility so a connection-string mistake cannot silently damage a non-disposable environment.

## Consequences

- CI can obtain reproducible real PostgreSQL/PostGIS migration evidence with one guarded command.
- This source checkpoint does not claim a database runtime pass until that command executes in an environment with PostgreSQL client tools and a fresh disposable target.
- Runtime execution remains separate from provider enablement, staff mutations and production approval.
