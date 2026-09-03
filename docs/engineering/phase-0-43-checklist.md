# Engineering Phase 0.43 — Guarded fatigue handover completion

- [x] Require ACTIVE account, Safety capability, current role and current owned task.
- [x] Require `SAFE_STOP_CONFIRMED` or `PASSENGER_TRANSFERRED` evidence state.
- [x] Require the original assignment and journey leg to be canonically terminal.
- [x] Require and release only the linked active `DRIVER_FATIGUE_SAFETY` hold.
- [x] Resolve the linked Support case and append immutable transitions.
- [x] Record a bounded completion evidence reference and database server time.
- [x] Keep retries idempotent and publish a transactional completion event.
- [x] Do not alter assignment or Journey state inside the completion command.
- [x] Do not clear the fatigue observation or claim that the Driver returned to work.
- [x] Do not claim external service contact.

Driver recovery and reactivation remain a separate, evidence-governed boundary.
