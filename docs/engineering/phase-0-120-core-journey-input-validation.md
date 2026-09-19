# Phase 0.120 — Core Journey route input validation

The database-backed Core Journey HTTP verifier now proves that malformed Rider and Driver booking identifiers return `400 INVALID_BOOKING_ID`, while malformed Control Room handover or booking identifiers return `400 INVALID_CONTROL_ROOM_JOURNEY_SCOPE`.

The proof also exercises an unexpected query parameter on the valid Control Room route. Query parameters do not alter the scoped read result because the route's authoritative scope remains the validated path parameters.

This is additive validation proof only; no authorization or journey-state policy is weakened.
