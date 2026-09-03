# Phase 0.42 fatigue safe-stop traceability

| Requirement | Implementation evidence |
|---|---|
| Current accountable operator | Effective role and owned task are revalidated in the locked command query |
| Eligible state only | Handover must be `OWNED` or `REPLACEMENT_ASSIGNED` |
| Supporting work remains open | Support case must be `IN_PROGRESS`; hold must be `ACTIVE` |
| Evidence-backed claim | Bounded reference persisted on handover and immutable transition |
| Server authority | Confirmation time comes from database `clock_timestamp()` |
| No premature completion | Response has `handoverComplete: false` and status `SAFE_STOP_CONFIRMED` |
| No premature hold release | Response and locked state retain active operational hold |
| Retry and delivery safety | Operator command deduplication and transactional outbox event |
| No false external response | `externalServiceContacted: false` |
