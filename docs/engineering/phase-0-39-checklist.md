# Engineering Phase 0.39 — Active-Journey fatigue handover lifecycle

- [x] Create one durable controlled-handover record per active-Journey fatigue observation.
- [x] Bind the record to the Safety hold, owned Support case, Journey, assignment and Driver.
- [x] Preserve passenger continuity as a database-enforced invariant.
- [x] Record the initial Driver request as immutable transition evidence.
- [x] Model ownership, replacement, passenger-transfer, safe-stop and completion as distinct states.
- [x] Reject lifecycle shortcuts and require monotonic aggregate versions and timestamps.
- [x] Require ownership before later operational states.
- [x] Require replacement, passenger-transfer or safe-stop evidence for the corresponding claims.
- [x] Make completed handovers terminal and preserve recorded evidence.
- [x] Return the handover identifier in the idempotent fatigue self-report response.
- [x] Do not claim Control Room ownership, replacement, transfer, safe stop or completion at creation.

Staff mutation endpoints remain disabled until task-scoped operator authority, operational evidence requirements and accountable staffing are implemented. The lifecycle foundation does not contact a third party or release the active Safety hold.
