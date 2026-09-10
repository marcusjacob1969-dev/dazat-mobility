# Engineering Phase 0.76 — RideCheck-to-Protected-Start HTTP

The hosted PostgreSQL vertical slice now crosses the protected pickup boundary. After geofenced arrival, the authenticated self-booking Rider initiates a bounded PIN RideCheck. The first response returns the challenge exactly once; idempotent replay retains the canonical session identity but omits the secret.

The assigned Driver submits that challenge through the real verification route. The service verifies the Rider, Driver, vehicle and active-assignment pairing using the stored salted verifier, then advances Booking and Journey to `PASSENGER_VERIFIED` without treating mismatch as automatic misconduct.

The Driver can start the Journey only after the service transactionally revalidates accepted arrival evidence, verified RideCheck, active and still-eligible assignment, fatigue safety and absence of an operational hold. The idempotent start advances both aggregates to `IN_PROGRESS`, and Rider and Driver projections converge on the same canonical state.
