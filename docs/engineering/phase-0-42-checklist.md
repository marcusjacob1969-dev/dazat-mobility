# Engineering Phase 0.42 — Evidence-governed fatigue safe stop

- [x] Require ACTIVE account, Safety capability, current role and current owned task.
- [x] Accept a bounded non-empty evidence reference, never arbitrary evidence content in the response.
- [x] Lock and require an `OWNED` or `REPLACEMENT_ASSIGNED` handover.
- [x] Require the linked Support case to remain `IN_PROGRESS` and Safety hold `ACTIVE`.
- [x] Record server time and append an immutable Control Room transition.
- [x] Advance only to `SAFE_STOP_CONFIRMED` with monotonic aggregate version.
- [x] Preserve mandatory passenger continuity and the active Safety hold.
- [x] Keep retries idempotent and publish a transactional safe-stop event.
- [x] Do not claim handover completion, hold release, Support resolution or external contact.

Completion remains a separate future command requiring independent proof that active passenger/assignment continuity is no longer at risk.
