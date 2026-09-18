# Phase 0.108 — Driver completion-path canonical refresh

Phase 0.108 closes the remaining Driver-side refresh gap in the demonstrable Rider → Driver → Control Room vertical slice.

The Driver screen already executes backend-authoritative Journey commands. This phase ensures the screen immediately re-reads the canonical Core Journey projection after the final operational transitions that matter to the vertical slice:

- Driver Safety SOS persistence
- governed destination approach
- governed Journey completion

The client still does not author Journey state. It only refreshes the backend projection after a successful command.

## Acceptance

- Driver Safety SOS refreshes the canonical Core Journey projection after persistence.
- Driver destination approach refreshes the canonical Core Journey projection.
- Driver Journey completion refreshes the canonical Core Journey projection.
- Existing Rider, Driver and Control Room HTTP boundaries remain unchanged and role/task scoped.
- `productionChargingEnabled` remains false.
- No real payment, communications, emergency-service or external mobility provider execution is introduced.
- Phase 0.108 has an executable verifier and is included in the current checkpoint chain.
