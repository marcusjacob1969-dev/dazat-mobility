# Engineering Phase 0.97 — Vertical-Slice Client Contract

## Objective

Protect the Rider-to-Driver-to-Control-Room journey boundary by making each client consume the same canonical server-owned core-journey projection through an authenticated, role-scoped adapter.

## Delivered

- Rider adapter is verified against the Booking-scoped core-journey progress route.
- Driver adapter is verified against the assignment-authorised progress route.
- Control Room adapter is verified as task-scoped through the fatigue-handover boundary.
- All three adapters are required to consume `CoreJourneyProgressProjection`, authenticate with bearer session authority, and fail closed on non-success responses.
- The current-checkpoint chain now executes the Phase 0.97 contract.

## Safety boundary

The client adapters do not create or infer Booking, assignment, Journey, Safety, Finance or provider state. The server projection remains authoritative, and provider/operational mutations remain disabled until separately approved.
