# Phase 0.40 Control Room handover-ownership traceability

| Requirement | Implementation evidence |
|---|---|
| Current staff authority | Effective-dated immutable `control_room_role_assignment` query |
| Active account only | Service rejects every non-`ACTIVE` account status |
| Least-privilege task | One immutable `DRIVER_FATIGUE_HANDOVER` task scope for one subject |
| Exclusive ownership | Unique purpose/subject scope plus locked `REQUESTED` handover |
| Atomic lifecycle alignment | Handover `OWNED` and Support case `IN_PROGRESS` in one transaction |
| Safety remains active | Claim requires and returns active operational hold truth |
| Passenger not stranded | `passengerContinuityRequired: true` remains explicit |
| No fictional operational result | `outcomeClaimed: false`; `externalServiceContacted: false` |
| Retry and delivery safety | Operator command deduplication and transactional outbox |
