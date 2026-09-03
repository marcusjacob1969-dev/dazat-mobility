# Phase 0.44 fatigue replacement-assignment traceability

| Requirement | Implementation evidence |
|---|---|
| Current accountable operator | Effective role and one current owned task are revalidated under lock |
| Original work terminated | Original assignment is cancelled/reassigned and original leg interrupted |
| Genuine replacement | Different Driver, same Booking, active assignment and non-terminal replacement leg |
| Canonical Journey truth | Journey `active_assignment_id` must already point at the supplied replacement |
| No dispatch shortcut | Command links an existing canonical assignment; it does not create or activate one |
| No transfer invention | Projection explicitly reports no passenger-transfer evidence and incomplete handover |
| Safety remains active | Linked fatigue hold remains active and Support case remains in progress |
| Retry and delivery safety | Operator deduplication and transactional outbox event |
