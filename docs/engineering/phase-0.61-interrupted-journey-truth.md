# Engineering Phase 0.61 — Interrupted journey truth

Phase 0.61 prevents cancelled, safety-held, incident, breakdown, reassignment and payment-failure bookings from being presented as ordinary forward journeys.

The shared progress contract now exposes an explicit disposition:

- `ACTIVE` for the canonical forward journey;
- `CLOSED` for completed or terminally cancelled journeys; and
- `SUPPORT_REQUIRED` for recoverable operational, safety or finance exceptions.

Interrupted journeys retain already-completed milestones, block unfinished milestones, disclose only the authoritative Booking status as the interruption reason, and never invent a forward milestone as the next action. Rider and Driver surfaces show a direct support-required message for recoverable exceptions.

This remains a read-only projection. It does not open a support case, contact a provider, resolve an incident, reverse a payment or grant any operator authority.
