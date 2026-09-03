# Engineering Phase 0.44 — Canonical fatigue replacement assignment

- [x] Require ACTIVE account, Safety capability, current role and current owned task.
- [x] Accept only a bounded replacement-assignment UUID and evidence reference.
- [x] Require the original assignment to be cancelled or reassigned and its leg interrupted.
- [x] Require an active different Driver assignment for the same Booking.
- [x] Require the Journey's canonical active assignment and replacement leg to match.
- [x] Advance only from `OWNED` to `REPLACEMENT_ASSIGNED`.
- [x] Preserve the active fatigue hold and in-progress Support case.
- [x] Keep passenger transfer, completion and external contact explicitly unclaimed.
- [x] Keep retries idempotent and publish a transactional event.

Passenger transfer remains a separately evidenced command; replacement assignment alone does not prove custody or handover.
