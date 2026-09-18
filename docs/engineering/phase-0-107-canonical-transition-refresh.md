# Phase 0.107 — Canonical Journey transition refresh

Phase 0.107 closes a presentation/integration verification gap in the Rider → Driver → Control Room vertical slice: after operational Journey transitions, client surfaces re-read the backend-authoritative Core Journey projection over HTTP rather than deriving operational phase from local mutation results.

## Cross-surface contract

- Rider reads `GET /v1/bookings/:bookingId/core-journey-progress`.
- Driver reads `GET /v1/driver/bookings/:bookingId/core-journey-progress`.
- Control Room reads the task-scoped `GET /v1/control-room/fatigue-handovers/:controlledHandoverId/bookings/:bookingId/core-journey-progress`.
- The Control Room route remains scoped to an active `DRIVER_FATIGUE_HANDOVER` task and its operator role assignment.
- All three surfaces render the same canonical `CoreJourneyProgressProjection` milestone collection.
- Core Journey remains read-only; clients do not create, advance, complete, reopen, or otherwise author milestone state.

## Acceptance

- Rider refreshes canonical Core Journey progress after dispatch and Journey/Safety transitions.
- Driver refreshes canonical Core Journey progress after assignment and Journey transitions.
- Control Room consumes the task-scoped canonical projection through its real HTTP reader.
- The verifier covers all three HTTP routes and rejects accidental mutation endpoints.
- No real payment, communications, or external provider execution is introduced.
- Current verification chain includes Phase 0.107.
