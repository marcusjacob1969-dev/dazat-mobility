# Phase 0.104 — screen projection surface

Phase 0.104 connects the shared Rider/Driver/Control Room Journey presentation bindings to the visible application surfaces.

The three applications render the same canonical Core Journey operational state through their surface adapters. UI-local state may control transient concerns such as loading and form visibility, but it does not determine journey phase, eligibility, safety holds, payment availability or completion.

## Acceptance boundary

- Rider, Driver and Control Room consume the shared Journey presentation contract at screen level.
- Canonical Core Journey progress remains the sole source of operational journey state.
- Safety/support, payment-provider-unavailable and completion remain distinct presentation outcomes.
- The screen projection is presentation-only and introduces no network calls, mutations, permissions, pricing, dispatch, payment, communications or external provider integrations.
- Production charging remains disabled.

## Screen integration

Each application now derives a surface-specific presentation object directly from its existing canonical Core Journey projection and renders that object as an operational Journey summary. The Rider and Driver adapters preserve their explicit surface identity; Control Room uses the shared surface contract directly. The UI never derives a Journey phase from local Journey status or invents a next action.

The existing detailed Journey controls remain in place for the current vertical slice. They continue to invoke authenticated backend commands; the new summary is a presentation projection and is not a second state machine.

## Verification

The Phase 0.104 verifier must prove all three screen sources import their surface contract, derive presentation from canonical `CoreJourneyProgressProjection`, expose the presentation phase/label/hint, and do not introduce client-side network or mutation logic in the presentation adapter.

The complete verification chain remains the release gate, including the seven core-journey demo scenarios and the production-charging-disabled invariant.
