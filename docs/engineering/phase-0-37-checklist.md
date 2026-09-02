# Engineering Phase 0.37 — Governed fatigue rest clearance

- [x] Provide an authenticated idempotent clearance command owned by the affected Driver.
- [x] Lock and revalidate the active fatigue observation and its active shift.
- [x] Block clearance while an assignment or non-completed Journey remains active.
- [x] Require the authoritative availability state to remain BREAK.
- [x] Calculate qualifying rest from server-recorded shift evidence and server time.
- [x] Apply the configured minimum qualifying-rest boundary.
- [x] Clear evidence only through the governed ACTIVE-to-CLEARED transition with actor and reason.
- [x] Append an authoritative `REST_COMPLETED` shift event and increment availability version.
- [x] Retain BREAK after clearance; never return the Driver to work automatically.
- [x] Keep clearance separate from Driver fault findings and external-contact claims.
- [x] Publish one canonical transactional outbox event and retain the idempotent response.

Returning to AVAILABLE remains a separate Driver work-intent command and must pass fresh operating-eligibility evaluation.
