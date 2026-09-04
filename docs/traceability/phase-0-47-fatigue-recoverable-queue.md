# Phase 0.47 recoverable fatigue-handover queue traceability

| Requirement | Implementation evidence |
|---|---|
| Supervisor-only discovery | ACTIVE session, Safety capability and current `SAFETY_SUPERVISOR` role |
| Genuine lapse | Latest task is expired and no current task exists |
| Passenger protection | Only ACTIVE hold plus IN_PROGRESS Support cases are returned |
| Bounded attention | Validated 1–100 limit and oldest-expiry-first ordering |
| Minimum data | No passenger identity/contact, location, narrative or previous operator identity |
| Advisory read | `recoveryEligibleAtRead` and `commandRevalidationRequired` remain explicit |
| Authoritative time | Projection uses `clock_timestamp()` even for an empty queue |
