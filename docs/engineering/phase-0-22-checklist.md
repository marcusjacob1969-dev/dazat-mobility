# Engineering Phase 0.22 checklist

## Source foundation completed

- [x] Add pull-request and `master` CI coverage for the guarded PostgreSQL migration runner.
- [x] Provision a disposable PostGIS 16 service with the allowlisted migration-validation database name.
- [x] Install only the PostgreSQL client required by the runner; no application/provider dependencies are needed for this check.
- [x] Run source guard tests before executing migrations.
- [x] Execute the complete 0001–0020 chain in CI when the workflow runs.

## Deliberately not claimed

- [ ] A CI run result before this repository is connected to a hosted Git provider.
- [ ] Application dependency compilation, transaction/concurrency scenarios or client E2E tests.
- [ ] Production database execution or any provider/staff mutation enablement.
