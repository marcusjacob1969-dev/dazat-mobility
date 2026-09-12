# Phase 0.101 — Canonical Journey UX

Phase 0.101 moves the product-facing journey experience from a generic UI foundation toward an explicit canonical journey presentation.

## Scope

The Rider experience now describes the authoritative journey as:

**Booking → Dispatch → Driver arrival → protected RideCheck → Journey → Safety/holds → governed completion → non-charging Finance outcome**

The Rider UI continues to read canonical Core Journey progress and presents `nextAction`, milestone status, protected-start holds, journey-health information, and provider-disabled Finance outcomes without inventing a driver, ETA, payment completion, or live location certainty.

Driver and Control Room remain consumers of authenticated backend projections. The Phase 0.101 verifier protects the cross-client contract by requiring canonical Core Journey usage and explicit handling of blocked/support-required states.

## Product rule

RideSub remains UX inspiration only. Local React state is never authoritative for dispatch, eligibility, safety, pricing, payment, completion, or operational truth.

## Safety and provider boundary

No production payment charging, external communications, emergency-provider execution, or third-party mobility provider call is enabled by this phase.

Unknown or stale telemetry must not be rendered as live certainty. Safety holds and support-required states remain visible and cannot be bypassed by normal client controls.

## Verification

`scripts/verify-phase-0-101.mjs` checks the Rider, Driver and Control Room source for canonical Core Journey projection usage and explicit blocked/support-required presentation, and verifies the Rider remains visibly provider-disabled.
