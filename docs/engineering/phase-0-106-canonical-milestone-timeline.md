# Phase 0.106 — Canonical Journey milestone timeline

Phase 0.106 extends the demonstrable Core Journey vertical slice from a single status card to a visible milestone timeline on Rider, Driver and Control Room.

The timeline is rendered directly from the canonical `CoreJourneyProgressProjection.milestones` collection. It is presentation-only: clients do not create, advance, complete, reopen or otherwise author milestone state.

## Acceptance

- Rider, Driver and Control Room render the same canonical milestone names and statuses.
- Safety/support, RideCheck, Journey and Finance blockers remain visible rather than being collapsed into a generic success state.
- The timeline is derived from the already-authoritative Core Journey projection.
- No new network calls, mutations, permissions, pricing, dispatch, payment, communications or providers are introduced.
- The current verification chain includes Phase 0.106.
