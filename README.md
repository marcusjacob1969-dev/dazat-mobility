# DAZAT Mobility

Production engineering source created from the DAZAT Mobility Master Blueprint v0.4.

Current checkpoint: **Engineering Phase 0.6**.

The server-authoritative vertical slice now reaches governed Journey completion:

`REGISTER → VERIFY → SESSION → BOOKING → QUOTE → CONFIRM → HARD-FILTERED DISPATCH → ATOMIC ASSIGNMENT → EVIDENCED PICKUP → RIDECHECK → PROTECTED START → LIVE JOURNEY → ARRIVING → GOVERNED COMPLETION`

Important Phase 0.6 integrity and Safety rules:

- Active telemetry begins only after protected Journey start and remains explicitly `LIVE`, `DELAYED`, `DEGRADED`, `STALE` or `UNKNOWN`.
- Out-of-order points and impossible jumps are retained as degraded evidence; they do not become automatic misconduct findings.
- Reconnecting clients replace speculative state with an authoritative snapshot.
- Journey health is `NORMAL`, `ATTENTION`, `AT_RISK` or `INCIDENT`; restricted Safety facts stay with the Safety owner.
- SOS, Silent Assistance and route concerns persist before downstream delivery attempts.
- Silent Assistance sets `do_not_auto_call_reporter=true` and canonical persistence never depends on an external provider.
- Route concerns are contextual, graded evidence and are database-constrained against automatic misconduct findings.
- Stop/destination requests are versioned and pending; they do not change the route until pricing, authority, communication and Driver acknowledgement rules succeed.
- `ARRIVING` requires fresh, accurate, confident, movement-plausible destination evidence.
- Completion requires active assignment, accepted destination evidence, no completion hold, no continuity blocker and any required authorised handover.
- School, hospital and specialist service contexts fail closed when handover evidence is missing or failed.
- Completion closes Journey, Booking, leg and assignment and returns the Driver to `AVAILABLE` atomically.
- Completion does not initiate or imply payment.

See `BUILD_STATUS.md`, `docs/architecture/ADR-0006-live-journey-safety-governed-completion.md`, and `docs/engineering/phase-0-6-checklist.md` for evidence and limitations.
