# Phase 0.100 — Rider/Driver/Control Room journey UI foundation

## Purpose

Phase 0.100 establishes a regression-tested foundation for the next substantive UI integration work. Rider, Driver and Control Room are required to consume the same canonical Core Journey contract rather than maintaining independent journey truth.

## Current evidence

- Rider imports and reads `CoreJourneyProgressProjection` through its authenticated Core Journey API.
- Driver imports the same projection contract and reads its role-scoped Core Journey progress API.
- Control Room reads Core Journey progress through its task-scoped, authority-bound API.
- All three applications use the DAZAT design system rather than introducing a separate visual token source.
- The current verifier now traverses Phase 0.100 in addition to the preceding checkpoint chain and continues to compile all three clients plus the API and run the runtime/core-journey verification.

## RideSub prototype adoption rule

The RideSub prototype is treated as UX inspiration only. Its live-ride monitor, fleet view, operational alerts, journey-stage presentation and subscription economics may inform future screens, but simulated React state must not become authoritative for pricing, dispatch, eligibility, Safety, payments, suspension or completion.

## Next substantive integration

The next implementation should turn the existing canonical reads into role-specific operational views:

1. Rider — dispatch, driver-en-route, RideCheck, Journey, Safety/hold and completion state.
2. Driver — availability, offer, eligibility, RideCheck, Journey and earnings state.
3. Control Room — live journey monitor, safety holds, eligibility/fatigue alerts and support state.

Every mutation remains authenticated, role-scoped, audited and backend-authoritative. Production payment, communications and external-provider calls remain disabled until separately approved.
