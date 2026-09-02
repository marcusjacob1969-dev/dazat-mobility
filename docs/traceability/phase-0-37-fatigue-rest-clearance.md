# Phase 0.37 fatigue rest-clearance traceability

| Requirement | Implementation evidence |
|---|---|
| Driver-owned governed clearance | `POST /v1/driver/fatigue-observations/:fatigueObservationId/clear-after-rest` and ownership-scoped observation query |
| Retry safety | `ClearDriverFatigueAfterRest` fingerprint and stored idempotent response |
| Passenger and Journey protection | Clearance conflicts while an active assignment or Journey exists |
| Real qualifying rest | Server-recorded BREAK event, database server time, and configured minimum duration |
| Auditable evidence transition | `ACTIVE` to `CLEARED`, actor, timestamp and `SERVER_EVIDENCED_QUALIFYING_REST` reason |
| No automatic work resumption | Availability remains BREAK while its version increments |
| Projection continuity | `REST_COMPLETED` closes the qualifying-rest interval for later eligibility checks |
| No automatic blame | `driverFaultFindingCreated: false` |
| Reliable downstream processing | `driver.fatigue-rest-cleared` transactional outbox event |
