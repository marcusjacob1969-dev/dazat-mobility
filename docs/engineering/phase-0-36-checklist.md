# Engineering Phase 0.36 — Fatigue self-report and continuity

- [x] Provide a bounded authenticated idempotent Driver fatigue-report command.
- [x] Require an active authoritative shift and a recent non-future observation time.
- [x] Preserve one active self-report observation per shift while making retries safe.
- [x] Stop new offers and Journey starts immediately through the Phase 0.35 projection.
- [x] Move an unassigned online Driver to BREAK atomically and append shift evidence.
- [x] Preserve ASSIGNED state when a passenger is active until controlled handover.
- [x] Create an active Journey Safety hold linked to the fatigue observation.
- [x] Create an owned high-risk human-escalation Support case with Journey, Booking and vehicle context.
- [x] Never claim an external service was contacted and never create a Driver fault finding.
- [x] Publish one canonical outbox event and store the full idempotent response.

Real Control Room staffing, external contact and hold release remain disabled. Clearing fatigue evidence requires a later governed authorised command with independent current-state revalidation.
