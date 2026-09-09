# Current delivery direction — connected core journey

Decision recorded: after Engineering Phase 0.48, prioritise a complete demonstrable Rider-to-Driver-to-Control-Room journey over further isolated feature slices.

This does not reduce or postpone safety. Every existing Identity, eligibility, fatigue, RideCheck, Journey, continuity, Finance and privacy guard remains authoritative. The objective is to prove those parts work together.

## Target vertical slice

1. Rider registers and creates a Booking with an explicit pickup and destination.
2. A provider-disabled test quote is created and accepted.
3. Dispatch evaluates current Driver, vehicle, location, schedule and fatigue eligibility.
4. One eligible Driver receives and accepts an informed offer.
5. Driver reaches the selected pickup using fresh location evidence.
6. Rider and Driver complete RideCheck before Journey start.
7. The Journey progresses under Control Room visibility and Safety holds.
8. Governed destination evidence permits completion.
9. Fare, Driver earning and receipt truth are recorded without charging real money.
10. Weak connectivity, ineligible Driver, failed RideCheck, active hold and stale destination evidence fail safely.

## Delivery order

- First: executable cross-domain scenario and failure proofs.
- Next: backend orchestration over the existing canonical services.
- Then: Rider, Driver and Control Room screens wired to the same orchestration.
- Finally: PostgreSQL/PostGIS, concurrency, device and production-like end-to-end verification before any provider or real-user pilot.

Production payments, communications and other providers remain disabled until separately selected and approved.
