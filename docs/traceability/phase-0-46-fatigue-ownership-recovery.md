# Phase 0.46 fatigue ownership-recovery traceability

| Requirement | Implementation evidence |
|---|---|
| No stranded expired task | Recovery accepts supported non-terminal handover states only after the latest task expires |
| No ownership theft | A current task-scope existence check fails closed under the locked handover transaction |
| Current accountable operator | ACTIVE account, Safety capability and current role are revalidated |
| Immutable provenance | Old scope remains immutable; transition records evidence and both task-scope references |
| Passenger protection retained | Operational hold stays `ACTIVE` and Support stays `IN_PROGRESS` |
| No invented outcome | Lifecycle state is preserved and outcome/provider-contact flags remain false |
| Retry and delivery safety | Operator-scoped request fingerprinting plus transactional outbox event |
