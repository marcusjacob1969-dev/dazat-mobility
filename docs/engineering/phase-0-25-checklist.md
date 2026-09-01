# Engineering Phase 0.25 checklist

## Completed

- [x] Separate API construction from process startup and network listening.
- [x] Inject the database, verification-delivery and pricing boundaries into the API factory.
- [x] Preserve fail-closed provider and operational-mutation configuration.
- [x] Verify liveness without requiring database availability.
- [x] Verify successful database readiness and disabled provider status reporting.
- [x] Verify failed readiness returns 503 without leaking dependency errors.
- [x] Verify application shutdown closes the database pool exactly once.
- [x] Update build metadata and the repository checkpoint.

## Still requires a capable runtime

- [ ] Execute the migration chain and transaction/concurrency scenarios on disposable PostgreSQL/PostGIS.
- [ ] Run authenticated end-to-end API flows against that disposable database.
- [ ] Run Expo applications on physical or emulated devices.
- [ ] Enable no provider or operational mutation without its separate accountable approval and controls.
