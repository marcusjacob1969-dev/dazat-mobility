# Engineering Phase 0.40 — Task-scoped Control Room handover ownership

- [x] Require an authoritative bearer session with an ACTIVE account.
- [x] Require a current immutable fatigue-handover operator or Safety-supervisor assignment.
- [x] Bound ownership to one purpose, one handover and no more than four hours or remaining role validity.
- [x] Claim only a `REQUESTED` handover with its Support case awaiting escalation and Safety hold active.
- [x] Atomically advance the handover to `OWNED` and Support case to `IN_PROGRESS`.
- [x] Append handover and Support-case transition evidence with the operator and task scope.
- [x] Preserve the active Safety hold and mandatory passenger continuity.
- [x] Make retries idempotent and publish one transactional ownership event.
- [x] Claim no replacement, passenger transfer, safe stop, external contact or completed outcome.
- [x] Grant no general Driver, Journey, Finance, Safety or direct-database-edit authority.

Role assignments require a separate accountable staff-authority process; this phase deliberately provides no public self-enrolment or role-assignment endpoint.
