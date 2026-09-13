# Phase 0.104 — screen projection surface

Phase 0.104 defines the next vertical-slice boundary after the shared Rider/Driver/Control Room Journey presentation bindings.

The three applications must render the same canonical Core Journey operational state through their surface adapters. UI-local state may control transient concerns such as loading and form visibility, but it must not determine journey phase, eligibility, safety holds, payment availability or completion.

## Acceptance boundary

- Rider, Driver and Control Room consume the shared Journey presentation contract.
- Canonical Core Journey progress remains the sole source of operational journey state.
- Safety/support, payment-provider-unavailable and completion remain distinct presentation outcomes.
- No new network calls, mutations, permissions, pricing, dispatch, payment, communications or external provider integrations are introduced by the presentation layer.
- Production charging remains disabled.

The next implementation slice should connect these projections directly to the existing journey cards/sections in each application and then prove the seven core-journey demo scenarios through the UI-facing contract.
