# Phase 0.102 — Journey UI integration contract

Phase 0.102 establishes the shared presentation contract that the Rider, Driver and Control Room surfaces will use when rendering canonical Core Journey progress.

## What changed

`@dazat/design-system` now exposes `presentCoreJourneyForSurface`, which combines the canonical `mapCoreJourneyToUiState` semantics with an explicit operational surface: `RIDER`, `DRIVER` or `CONTROL_ROOM`.

The adapter supplies surface-specific explanatory hints while preserving the same authoritative phase, tone, actionability and action label. It is deliberately presentation-only.

## Authority boundaries

The adapter does not fetch data, mutate journeys, decide permissions, calculate pricing, dispatch drivers, create payments, send communications or call external providers. The backend Core Journey projection remains authoritative.

A UI surface must treat the returned state as render data. It must not recreate a client-side journey state machine or infer a new operational state from local React state.

## Next vertical-slice step

Phase 0.103 should wire the adapter into the existing Rider, Driver and Control Room screens, with source-level regression tests proving each surface consumes the canonical projection and that safety, support, payment-provider-unavailable and completion states remain distinct.

Production payment, communications and external mobility providers remain disabled.
