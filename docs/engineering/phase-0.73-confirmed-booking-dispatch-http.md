# Engineering Phase 0.73 — Confirmed-Booking-to-Dispatch HTTP

The authenticated hosted vertical slice now sends the newly confirmed Rider Booking into the actual Dispatch command. Because the disposable fixture deliberately supplies no fully authorised Driver, the expected authoritative result is `NO_ELIGIBLE_DRIVER` with zero eligible candidates and zero offers.

The command is replayed with its idempotency key and must return the same outcome. A subsequent canonical progress read must show `SUPPORT_REQUIRED` and a blocked Driver-assigned milestone, proving that Dispatch failure becomes shared user-facing truth rather than a fabricated assignment or an indefinite search.

This is the deliberate fail-safe branch. The eligible Driver offer-and-acceptance branch remains the next connected checkpoint.
