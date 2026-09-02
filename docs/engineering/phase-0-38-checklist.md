# Engineering Phase 0.38 — Driver fatigue recovery status

- [x] Provide an authenticated Driver-owned read without a mutation or idempotency requirement.
- [x] Report the latest active fatigue observation and associated shift.
- [x] Measure rest only from authoritative BREAK events and database server time.
- [x] Expose configured qualifying-rest minutes alongside elapsed minutes.
- [x] Revalidate active assignments and Journeys as a clearance blocker.
- [x] Return exact blockers for missing evidence, inactive shift, active work, non-BREAK state and incomplete rest.
- [x] Mark clearance eligible only when every blocker is absent.
- [x] Never clear evidence, resume work, create a Driver fault finding or claim external action from the read.

The status projection is advisory display data over current authoritative state. The Phase 0.37 command repeats all checks transactionally before clearing evidence.
