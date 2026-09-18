# Phase 0.107 — Canonical Journey transition refresh

Phase 0.107 closes a presentation gap in the Rider and Driver vertical slice: after operational Journey transitions, the UI immediately re-reads the backend-authoritative Core Journey projection.

Rider and Driver retain their existing operational Journey APIs for commands and detailed Journey state, while the canonical Core Journey projection is refreshed after those transitions. The UI therefore does not infer operational phase from local mutation results.

## Acceptance

- Rider refreshes canonical Core Journey progress after dispatch and Journey/Safety transitions.
- Driver refreshes canonical Core Journey progress after assignment and Journey transitions.
- Core Journey remains a read projection; clients do not mutate milestone or phase state.
- No real payment, communications or external provider execution is introduced.
- Current verification chain includes Phase 0.107.
