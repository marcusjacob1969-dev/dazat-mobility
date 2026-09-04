# Engineering Phase 0.46 — Expired fatigue-handover ownership recovery

- [x] Require an ACTIVE account, Safety capability and a current fatigue-handover role.
- [x] Recover only a non-terminal handover whose latest task has expired.
- [x] Refuse recovery while any current task scope exists.
- [x] Require the linked fatigue hold ACTIVE and Support case IN_PROGRESS.
- [x] Preserve immutable old task scopes and create one bounded replacement scope.
- [x] Preserve the existing lifecycle state and passenger-continuity requirement.
- [x] Record bounded recovery evidence, previous/new task references and a same-state transition.
- [x] Keep retries idempotent and publish the recovery through the transactional outbox.
- [x] Claim no passenger outcome, provider contact, Driver recovery or handover completion.

Expiry removes task authority; it does not remove the passenger-protection hold. Recovery restores accountable ownership only.
