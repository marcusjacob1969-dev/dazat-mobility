# Phase 0.105 — Core Journey screen scenario matrix

Phase 0.105 proves that the canonical Core Journey presentation semantics remain consistent across Rider, Driver and Control Room for the operational states used by the demonstrable vertical slice.

The matrix covers support interruption, provider-disabled payment, completion, protected RideCheck/start, dispatching, driver-en-route and active Journey states. Each surface must render the same phase, label and safety tone; only the surface-specific operational hint may differ.

No new network calls, mutations, permissions, pricing, dispatch, payment, communications or provider integrations are introduced. The matrix is a pure presentation regression gate.

## Acceptance

- Canonical next-action semantics map to one shared Journey UI phase across all three surfaces.
- Safety/support, payment-provider-unavailable and completion remain distinct.
- Surface hints may differ because the Rider, Driver and Control Room have different operational responsibilities.
- The test consumes the compiled design-system presentation contract and does not create client-side authority.
- Historical checkpoint verifiers use durable architectural boundaries rather than obsolete screen-copy literals.
