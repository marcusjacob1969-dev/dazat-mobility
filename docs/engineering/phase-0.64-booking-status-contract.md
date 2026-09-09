# Engineering Phase 0.64 — Booking status contract

Core-journey progress now uses the authoritative domain `BookingStatus` type instead of an unconstrained string. The OpenAPI response schema publishes the same complete canonical and exception status vocabulary.

This closes a drift path that previously allowed misspelled or invented Booking states to compile into the vertical-slice projection while keeping the database enum as runtime authority.
