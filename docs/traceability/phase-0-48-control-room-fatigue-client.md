# Phase 0.48 Control Room fatigue client traceability

| Requirement | Implementation evidence |
|---|---|
| Bounded queue | Client clamps requested limit to 1–100 |
| Session authority | Bearer token is required on queue and command calls |
| No stale browser cache | Both calls set `cache: 'no-store'` |
| Safe command retry | Recovery requires caller-supplied idempotency key |
| Bounded payload | Only `recoveryEvidenceReference` is serialized |
| Path safety | Handover ID is encoded before interpolation |
| Truthful UX | Surface distinguishes advisory queue truth from locked command revalidation |
| Privacy | Surface states the excluded passenger, location, narrative and operator scopes |
