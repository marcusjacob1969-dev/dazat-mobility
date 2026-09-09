# Engineering Phase 0.50 — Persistent core-journey progress

Phase 0.50 connects the established Booking, Pricing, Dispatch, Journey, RideCheck and Finance records into one authenticated Rider projection:

`GET /v1/bookings/:bookingId/core-journey-progress`

The endpoint is read-only and derives every milestone from canonical persisted records. It creates no parallel workflow state, reveals no RideCheck secret, and keeps production charging explicitly disabled. Access requires an active Rider session and participation in the Booking as Booker, Passenger or Payer.

The response reports the first incomplete or blocked milestone so clients can continue the real journey without inventing state locally. A locked RideCheck remains blocked; Finance cannot begin before governed Journey completion; absence of a provider-backed payment never appears as a successful charge.
