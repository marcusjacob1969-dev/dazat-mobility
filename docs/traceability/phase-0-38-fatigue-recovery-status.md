# Phase 0.38 fatigue recovery-status traceability

| Requirement | Implementation evidence |
|---|---|
| Driver can see recovery state | `GET /v1/driver/fatigue-recovery-status` with Driver profile authority |
| Rest is not client-claimed | BREAK event timing and `clock_timestamp()` are database-owned |
| Requirement is explicit | `requiredRestMinutes` comes from governed API configuration |
| Safety blockers are understandable | Five typed blocker codes distinguish evidence, shift, work, intent and duration |
| Read cannot clear evidence | Service performs one projection query and no transaction or update |
| Command remains authoritative | Phase 0.37 repeats locked current-state checks before mutation |
| No coercive resumption | `automaticReturnToWork: false` and current availability remain explicit |
| No automatic blame | `driverFaultFindingCreated: false` |
