# Engineering Phase 0.48 — Control Room fatigue-recovery client boundary

- [x] Add a typed client for the bounded recoverable-handover queue.
- [x] Clamp client queue requests to the backend 1–100 limit.
- [x] Require bearer authority and no-store fetch behaviour.
- [x] Add an evidence-backed recovery client with an explicit idempotency key.
- [x] Encode the handover path component and serialize only the approved evidence field.
- [x] Keep queue-read truth separate from recovery-command authority.
- [x] Add a Control Room boundary surface explaining exclusions and retained hold truth.
- [x] Avoid local claims of completion, provider contact or Driver recovery.

This is an application boundary, not a production staffing workflow or generic Safety data browser.
