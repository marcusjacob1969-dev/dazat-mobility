# Engineering Phase 0.47 — Recoverable fatigue-handover queue

- [x] Require ACTIVE account, Safety capability and current `SAFETY_SUPERVISOR` role.
- [x] Return only supported non-terminal handovers whose latest task has expired.
- [x] Exclude every handover with a currently valid task scope.
- [x] Require the passenger-protection hold ACTIVE and Support case IN_PROGRESS.
- [x] Bound the request to 1–100 items with a safe default of 25.
- [x] Order oldest expiry first for deterministic operational attention.
- [x] Exclude passenger identity/contact, precise location, narrative and previous operator identity.
- [x] Mark the queue as read-time eligibility and require command revalidation.
- [x] Use database time for both populated and empty results.

The queue discovers potentially stranded safety work. It grants no ownership and performs no mutation.
