# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.5 — Assignment-to-Pickup Journey Foundation + RideCheck Boundary**

Status: **SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / DATABASE, CONCURRENCY AND APP RUNTIME NOT YET VERIFIED**

DAZAT is being built cleanly from the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository.

### Implemented source

- All Phase 0.1–0.4 monorepo, identity, verified-session, Booking, development-quote, hard-filter Dispatch and atomic-assignment foundations.
- Active assignment acknowledgement materialises one authoritative Journey and first JourneyLeg.
- Guarded Booking/Journey spine: `DRIVER_ASSIGNED → DRIVER_EN_ROUTE → DRIVER_ARRIVED → AWAITING_RIDECHECK → PASSENGER_VERIFIED → IN_PROGRESS`.
- Append-only location observations with client/server time, source, purpose, accuracy, confidence, telemetry state and retention class.
- Read-time `LIVE / DELAYED / DEGRADED / STALE / UNKNOWN` telemetry classification.
- Immutable arrival evidence requiring fresh/accurate/confident location inside a configured pickup radius.
- Self-booker PIN RideCheck bound to passenger, current leg, assignment, Driver and vehicle.
- One-time Rider challenge return; only salted HMAC verifier material is persisted and comparisons are constant-time.
- Append-only, expiring and bounded RideCheck attempts.
- Exhausted mismatch creates a protected operational hold and canonical SafetyEvent without declaring misconduct.
- Journey start re-locks and revalidates state, current assignment/eligibility, verified RideCheck, pickup evidence and absence of an active hold.
- Actor/subject-scoped command idempotency, client observation deduplication and transactional outboxes.
- Rider/Driver reconciliation projections and read-only Control Room projection contract with explicit telemetry uncertainty.

### Verified in this checkpoint

- Earlier foundation, Phase 0.2, Phase 0.3 and Phase 0.4 structural verification remains available.
- Phase 0.5 required-file, security-boundary and protected-start verification: **PASSED**.
- Seven pure-domain/security tests for Journey transitions, arrival evidence, telemetry quality, salted/session-bound RideCheck verification, bounded attempts and protected start: **PASSED**.
- Blueprint traceability for `API-JRN-001`, `LOC-001`, `RT-LOC-001`, `SEC-AUTH-001`, `API-IDEM-001`, `DAT-RCK-001`, `AUD-001`, `XDT-009` and protected-start acceptance: **recorded**.

### Not yet verified / deliberately not claimed

- PostgreSQL/PostGIS migrations 0001–0005 and transaction/concurrency cases have not been executed in this workspace.
- Fastify, Expo and Vite workspaces have not been compiled with installed workspace dependencies here.
- Only self-booker PIN RideCheck is implemented; QR, assisted, guardian/school, accessible restart/delivery and replacement flows remain governed future work.
- Safety assessment, authorised hold release, production location retention, real-time streams and provider delivery are not implemented.
- Location thresholds/radii are configuration defaults awaiting operational, privacy, accessibility and Safety validation.
- No production Driver, vehicle, passenger, location, Safety, pricing, provider credentials or data are present.
- Source creation is not production readiness, licensing approval, insurance cover or security certification.

## Next checkpoint

**Engineering Phase 0.6 — Live Journey Monitoring + Governed Completion Foundation**

Planned spine: `IN_PROGRESS → ARRIVING → COMPLETED` with low-distraction active-journey telemetry, destination/stop governance, route concern/Safety signals, connectivity reconciliation, service-specific handover gates and completion evidence. Payment/ledger truth remains a later separately governed checkpoint.
