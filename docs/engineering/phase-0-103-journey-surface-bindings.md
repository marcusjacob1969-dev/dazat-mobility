# Phase 0.103 — Journey surface bindings

Phase 0.103 adds explicit Rider, Driver and Control Room bindings to the shared Journey presentation contract established in Phase 0.102.

## Surface bindings

- Rider: `presentRiderJourney`
- Driver: `presentDriverJourney`
- Control Room: `presentControlRoomJourney`

Each binding accepts canonical `nextAction`, interruption and Journey status inputs and delegates directly to `presentCoreJourneyForSurface`. The binding fixes the operational surface identity without duplicating Journey semantics.

## Authority boundary

The bindings are presentation-only. They do not fetch, mutate, authorise, price, dispatch, create payments, send communications or call external providers. Existing applications continue to consume `CoreJourneyProgressProjection` from their role-scoped APIs.

The next screen-level integration step is to replace remaining local Journey-status presentation branches with these bindings. That change must preserve the same canonical projection and must not introduce a client-side Journey state machine.

## Verification

`verify-phase-0-103.mjs` proves all three bindings exist, use the shared design-system contract, pin their surface identity, remain network-free, and that the three applications retain canonical Core Journey projection consumption. `verify-current.mjs` now includes Phase 0.103.

Production payments, communications and external mobility providers remain disabled.
