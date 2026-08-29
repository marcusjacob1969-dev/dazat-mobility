# ADR-0005: Assignment-to-Pickup Journey and Protected Start

Status: Accepted for Engineering Phase 0.5 source checkpoint
Date: 2026-08-29

## Context

Phase 0.4 ends with one active, eligibility-validated DriverAssignment and Booking `DRIVER_ASSIGNED`. The Master Blueprint requires backend-owned progression through acknowledgement, en route, evidenced arrival, RideCheck, passenger verification and Journey start. A client, ordinary support user, stale projection or old location point must not manufacture arrival or skip RideCheck.

## Decision

1. `Journey` is the authoritative service-execution aggregate and `JourneyLeg` records the active Driver/vehicle segment. The Booking remains the customer/commercial container.
2. Driver acknowledgement materialises Journey/Leg from the active assignment and atomically advances Journey/Booking to `EN_ROUTE` / `DRIVER_EN_ROUTE`.
3. Driver location ingestion is a dedicated append-only contract. Each durable observation records device time, server receipt time, source, purpose, accuracy, confidence, telemetry state and retention class.
4. Arrival requires the latest observation to pass configured age, future-skew, accuracy and confidence rules and fall inside the configured pickup radius. The accepted decision is stored as immutable `ArrivalEvidence`.
5. Phase 0.5 implements self-booker PIN RideCheck. The Rider receives the generated PIN once. Only a per-session salt and HMAC verifier are persisted; neither the raw PIN nor a submitted PIN is recorded.
6. Every RideCheck attempt is append-only and bounded. Exhaustion locks the session, creates an active operational hold and a canonical SafetyEvent, and emits an intervention-required event. Mismatch is not a misconduct finding.
7. Journey start re-locks the authoritative Journey, Booking, active assignment and leg. It requires `PASSENGER_VERIFIED`, a verified RideCheck for the current leg/assignment/vehicle, current Driver/vehicle eligibility, fresh pickup evidence and no active operational/Safety hold.
8. Normal Rider, Driver and Control Room surfaces have no bypass command. Exceptional audited assisted/guardian/school methods and hold release need their own authorised workflows; they are not guessed in this checkpoint.
9. Command deduplication is actor-and-subject scoped. Location ingestion uses a client observation UUID. The one-time PIN is intentionally omitted from the deduplicated replay response.
10. Live Rider/Driver projections calculate telemetry freshness at read time and declare that critical mutation requires owner-state revalidation. The Control Room database view is read-only.

## Consequences

- An assigned Driver cannot jump directly to `IN_PROGRESS`.
- An old but previously `LIVE` observation becomes `STALE` when projected later.
- A close coordinate with poor accuracy/confidence cannot authorise arrival.
- A valid RideCheck cannot be reused across a future replacement leg because the session binds JourneyLeg, assignment, Driver and vehicle.
- A RideCheck response lost after commit cannot safely replay the plaintext PIN; the Rider must use the originally displayed value or a future governed restart/delivery workflow.
- PostgreSQL transaction/concurrency behaviour, full runtime compilation and end-to-end mobile interaction remain verification work until the required runtime is available.
