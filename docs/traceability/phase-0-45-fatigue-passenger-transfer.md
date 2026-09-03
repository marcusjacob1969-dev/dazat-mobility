# Phase 0.45 fatigue passenger-transfer traceability

| Requirement | Implementation evidence |
|---|---|
| Current accountable operator | Effective role and current task owner are revalidated under lock |
| Genuine replacement continuity | Replacement is active, canonical for the Journey and its leg is in progress |
| Original Driver removed | Original assignment remains cancelled/reassigned and original leg interrupted |
| Evidence-backed transition | Bounded reference is persisted on the handover and immutable transition |
| No premature closure | Handover becomes `PASSENGER_TRANSFERRED`; hold and Support case stay open |
| No invented provider response | `externalServiceContacted: false` |
| Retry and delivery safety | Operator deduplication and transactional outbox event |
