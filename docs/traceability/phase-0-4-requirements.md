# Engineering Phase 0.4 — Blueprint traceability

| Blueprint requirement | Phase 0.4 source evidence | Status |
|---|---|---|
| `DRV-CMP-001` — Driver cannot go online without valid compliance | `setDriverAvailability` hard gate + latest append-only snapshots | SOURCE_CREATED / RUNTIME_NOT_YET_VERIFIED |
| `DSP-001` — only eligible Drivers enter candidate pool | `evaluateDriverDispatchEligibility` + Dispatch candidate query | SOURCE_CREATED / RUNTIME_NOT_YET_VERIFIED |
| `LOC-001` — location has time/source/confidence; stale is not current | availability schema, freshness/confidence hard filter | SOURCE_CREATED / RUNTIME_NOT_YET_VERIFIED |
| `DRV-OFF-001` — ordinary location stops offline | OFFLINE upsert clears location/source/confidence | SOURCE_CREATED / RUNTIME_NOT_YET_VERIFIED |
| Meaningful non-punitive Driver offers | versioned `driver_offer` payload/expiry; no acceptance penalty field | SOURCE_CREATED |
| Atomic assignment race protection | DispatchAttempt row lock + two partial unique indexes | SOURCE_CREATED / CONCURRENCY_TEST_PENDING |
| `BKG-NOD-001` / `XDT-004` — truthful no-driver state | `NO_ELIGIBLE_DRIVER` Booking and Dispatch transition | SOURCE_CREATED / E2E_PENDING |
| `XDT-005` — two acceptances produce one assignment | lock/unique constraints + safe conflict path | SOURCE_CREATED / POSTGRES_RACE_TEST_PENDING |
| Hard accessibility/service requirements survive Dispatch | Booking requirements matched to eligibility snapshot capabilities | FOUNDATION_CREATED / CATALOGUE_DEPTH_PENDING |
| Control Room cannot force ineligible assignment | no bypass/write path; shell states future commands must revalidate | FOUNDATION_CREATED |
| Authoritative changes emit events | Booking and Dispatch transactional outboxes | SOURCE_CREATED / WORKER_RUNTIME_PENDING |

## Evidence limitation

This checkpoint deliberately distinguishes source evidence from executed integration evidence. The database migration, HTTP service, mobile clients and real concurrent acceptance race have not run in this workspace because PostgreSQL/Docker and installed workspace dependencies are unavailable. No production readiness claim is made.
