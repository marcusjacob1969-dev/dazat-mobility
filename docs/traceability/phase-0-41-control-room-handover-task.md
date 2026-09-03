# Phase 0.41 Control Room handover-task traceability

| Requirement | Implementation evidence |
|---|---|
| Current owner only | Query binds task `operator_person_id` to authenticated person |
| Expiry is authoritative | Task and role effective windows are rechecked on every read |
| Minimum operational context | Lifecycle, case, hold, assignment and evidence-presence booleans only |
| No sensitive passenger scope | Five explicit exclusion flags in the response contract |
| No evidence-content leakage | Projection returns booleans, not transfer or safe-stop references |
| No UI-invented transitions | Server derives exact permitted next-action names from current status |
| No authority expansion | Journey/Support IDs remain references; task scope covers one handover only |
| Read-only boundary | `GET` projection performs no transaction, update or outbox write |
