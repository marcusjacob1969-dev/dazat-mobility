# Phase 0.43 fatigue handover completion traceability

| Requirement | Implementation evidence |
|---|---|
| Current accountable operator | Effective role and owned task are revalidated in the locked command query |
| Evidence state | Handover must be `SAFE_STOP_CONFIRMED` or `PASSENGER_TRANSFERRED` |
| Canonical passenger continuity | Original assignment must be non-active and its journey leg interrupted or completed |
| Narrow hold release | The locked hold must be active and have reason `DRIVER_FATIGUE_SAFETY` |
| Atomic closure | Handover, fatigue hold and Support case update in one transaction |
| Immutable audit | Handover, hold and Support transitions record operator, reason and server time |
| Retry and delivery safety | Operator command deduplication and transactional outbox event |
| Recovery separation | Response explicitly says fatigue observation not cleared and Driver not returned to work |
| No invented external response | `externalServiceContacted: false` |
