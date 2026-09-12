# Engineering Phase 0.99 — Dispatch concurrency contract

Phase 0.99 moves the Rider → Driver → Control Room vertical slice from scenario-only proof toward production-like concurrency discipline.

The dispatch command boundary is transactional. Starting Dispatch locks the authoritative Booking row before reading and advancing its aggregate state. Booking transitions use optimistic aggregate-version matching, while command idempotency records prevent a retried command from producing a second effect.

Driver availability changes are also transactional and lock the driver's availability state. Offer acceptance is governed by an idempotency key and authoritative Driver/assignment state rather than a stale client projection. Eligibility is re-evaluated from current compliance, vehicle, permission, maintenance, fatigue, availability, location and schedule evidence inside the command path.

The canonical Core Journey progress projection remains read-only. It joins authoritative Booking, fare agreement, Dispatch, assignment, Journey, arrival evidence, RideCheck and payment-intent state and exposes `productionChargingEnabled: false`. The projection is therefore suitable for Rider, Driver and Control Room visibility without becoming a second source of truth.

Phase 0.99 adds `scripts/verify-phase-0-99.mjs` as an executable regression contract for these boundaries. This checkpoint does not activate real payment, communications, emergency-service or external mobility providers.
