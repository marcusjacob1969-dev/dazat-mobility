# Engineering Phase 0.45 — Evidence-governed passenger transfer

- [x] Require ACTIVE account, Safety capability, current role and current owned task.
- [x] Accept a bounded non-empty evidence reference.
- [x] Require `REPLACEMENT_ASSIGNED` and the same canonical replacement assignment.
- [x] Require the replacement assignment active and its Journey leg in progress.
- [x] Reconfirm original assignment and leg termination.
- [x] Advance only to `PASSENGER_TRANSFERRED` with immutable evidence.
- [x] Preserve the linked active fatigue hold and in-progress Support case.
- [x] Keep completion and external contact explicitly unclaimed.
- [x] Keep retries idempotent and publish a transactional transfer event.

Transfer evidence makes completion eligible; it does not itself release the fatigue hold.
