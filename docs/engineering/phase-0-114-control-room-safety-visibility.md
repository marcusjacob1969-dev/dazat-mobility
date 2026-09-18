# Phase 0.114 — Control Room Safety hold visibility

Control Room now makes the canonical `SUPPORT_REQUIRED` disposition and interruption reason visibly explicit when a task-scoped Core Journey projection reports an active operational intervention.

The panel is presentation-only. It does not clear holds, mutate Journey state, bypass evidence, or create a second client-side state machine.

The existing task scope remains the authorization boundary.
