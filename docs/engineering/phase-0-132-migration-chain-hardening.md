# Engineering Phase 0.132 — Migration-chain hardening

Phase 0.131 introduced database-enforced Payment/PaymentIntent consistency, but the migration verification runner still described the older 0001–0031 chain. Phase 0.132 brings the guarded migration runner up to the current 0001–0034 schema and makes the two new Finance consistency triggers part of the disposable-database verification.

## Changes

- Repair PostgreSQL dollar-quoting in both trigger functions in migration 0034.
- Require exactly 34 ordered migrations, ending at `0034_payment_intent_consistency.sql`.
- Require the Finance PaymentIntent relation in the post-migration relation check.
- Verify both Payment consistency triggers exist after the disposable migration chain runs.
- Advance the current checkpoint verifier through Phase 0.132.
- Add a source verifier for the migration-chain boundary.

## Safety boundary

The migration runner only accepts an explicitly disposable `dazat_migration_verify_*` PostgreSQL database and requires `DAZAT_MIGRATION_VALIDATION_TARGET=ephemeral`. No production database is targeted by this verification.

## Result

This phase closes a CI/schema-verification drift identified immediately after Phase 0.131 and ensures the database-integrity migration is actually executable and observable by the guarded migration path.
