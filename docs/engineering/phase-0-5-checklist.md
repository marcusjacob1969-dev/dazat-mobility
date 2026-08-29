# Engineering Phase 0.5 Checklist

Checkpoint: Assignment-to-Pickup Journey Foundation + RideCheck Boundary
Status: SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / DATABASE AND APP RUNTIME UNVERIFIED

## Source implementation

- [x] Active DriverAssignment acknowledgement creates one Journey and first JourneyLeg.
- [x] Booking and Journey advance through guarded, append-only transition histories.
- [x] Dedicated append-only Driver location observations carry device/server timestamps, source, purpose, accuracy and confidence.
- [x] Telemetry exposes `LIVE`, `DELAYED`, `DEGRADED`, `STALE` or `UNKNOWN` instead of fabricated live certainty.
- [x] Arrival requires fresh, accurate, confident location within a configurable pickup radius.
- [x] Accepted arrival evidence binds the location observation and immutable Booking pickup snapshot.
- [x] PIN RideCheck binds passenger, current DriverAssignment, Driver, vehicle and JourneyLeg.
- [x] Raw RideCheck PIN and submitted PIN are never persisted; verification uses salted HMAC and constant-time comparison.
- [x] RideCheck attempts are append-only, expiring and bounded.
- [x] Exhausted mismatch creates an active operational hold and canonical SafetyEvent without an automatic misconduct finding.
- [x] Protected start revalidates Journey/Booking state, active assignment, Driver/vehicle eligibility, verified RideCheck, fresh pickup evidence and absence of a hold.
- [x] Journey commands are actor/subject idempotent; location events use a client observation identifier.
- [x] Rider and Driver projections reconcile authoritative state and reclassify telemetry freshness at read time.
- [x] Control Room shell exposes uncertainty and states that normal support cannot bypass the protected start.
- [x] OpenAPI documents the Phase 0.5 commands and dedicated location contract.

## Verification completed here

- [x] Phase 0.5 source/security verifier passes.
- [x] Pure Journey state-transition tests pass.
- [x] Fresh versus stale/degraded pickup-evidence tests pass.
- [x] Bounded RideCheck mismatch/lock tests pass.
- [x] RideCheck verifier is salted, session-bound and constant-time compared.
- [x] Protected-start all-preconditions test passes.
- [x] Node TypeScript syntax checks pass for new domain/contracts/service/routes/client modules.
- [x] Repository whitespace/error check passes.

## Not yet executed or claimed

- [ ] Run migrations 0001–0005 against PostgreSQL 16 + PostGIS.
- [ ] Exercise two concurrent/duplicate arrival, RideCheck and Journey-start commands against PostgreSQL locks and uniqueness.
- [ ] Compile the complete Fastify, Expo and Vite workspaces with installed dependencies.
- [ ] Run Rider/Driver/Control Room end-to-end tests on authenticated runtime data.
- [ ] Implement an approved production RideCheck delivery/restart strategy and accessible assisted/guardian/school variants.
- [ ] Implement authorised Safety assessment, hold acknowledgement/release and protected audit roles.
- [ ] Validate location thresholds, pickup radii and retention policy with Operations, Safety, privacy and accessibility owners.
- [ ] Complete security/adversarial testing, production secrets management, observability and incident rehearsal.

This checkpoint is executable source evidence, not production readiness, a public service launch, a Safety sign-off or a licensing/insurance claim.
