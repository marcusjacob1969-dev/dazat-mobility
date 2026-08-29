# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.4 — Dispatch Foundation + Driver Availability/Eligibility Boundary**

Status: **SOURCE IMPLEMENTED / STATIC GUARDS VERIFIED / DATABASE, CONCURRENCY AND APP RUNTIME NOT YET VERIFIED**

DAZAT is being built cleanly from the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository.

### Implemented source

- All Phase 0.1–0.3 monorepo, identity, verified-session, Booking and development-quote foundations.
- Append-only Driver and vehicle eligibility snapshots with policy, blocker, expiry and evidence fields.
- Driver-to-vehicle authorisation and versioned online/offline/break/finishing availability.
- OFFLINE clears ordinary Driver-app location from active availability state.
- Location timestamp, source, confidence and staleness hard filter.
- Pure hard-eligibility decision covering account, Driver approval, compliance, authorised vehicle, vehicle eligibility, availability, location, existing assignment, schedule conflict and Booking requirements.
- Hard-filtered candidate snapshots before ranking.
- Provisional straight-line pickup distance recorded only as a ranking factor, not a road ETA.
- Controlled meaningful Driver offer wave with expiry and no ordinary acceptance-rate punishment.
- Eligibility and Booking-state revalidation at acceptance.
- DispatchAttempt locking plus database uniqueness for one active assignment per Booking and per Driver.
- Atomic DriverAssignment, competing-offer withdrawal, Driver availability change and Booking `DRIVER_ASSIGNED` transition.
- Explicit `NO_ELIGIBLE_DRIVER` outcome when the hard-filter pool is exhausted.
- Rider Dispatch projection and Driver readiness/availability/offer/acceptance client wiring.
- Control Room shell states that manual operations cannot bypass hard eligibility.

### Verified in this checkpoint

- Recovered Phase 0.3 structural verification: **PASSED**.
- Phase 0.4 required-file and source-security verification: **available**.
- Pure-domain tests for full eligibility, expired compliance, stale location and unsafe state shortcuts: **created**.
- Blueprint traceability for `DSP-001`, `DRV-CMP-001`, `LOC-001`, `DRV-OFF-001`, `BKG-NOD-001`, `XDT-004` and `XDT-005`: **recorded**.

### Not yet verified / deliberately not claimed

- PostgreSQL/PostGIS migrations have not been executed in this workspace.
- The two-Driver concurrent acceptance race has not been executed against PostgreSQL.
- Fastify API and Expo clients have not been compiled with installed workspace dependencies here.
- Compliance approval and vehicle onboarding commands/providers are not yet implemented; Dispatch cannot self-approve a Driver.
- Road-time routing/ETA, scheduled reservation/conflict policy and real-time push delivery are not configured.
- No production Driver, vehicle, location, pricing or provider credentials/data are present.
- Source creation is not production readiness, licensing approval, insurance cover or security certification.

## Next checkpoint

**Engineering Phase 0.5 — Assignment-to-Pickup Journey Foundation + RideCheck Boundary**

Planned spine: assigned Driver acknowledges work → driver-en-route → arrived → protected pickup/RideCheck → passenger verified → Journey start, with stale-location handling, Rider/Driver reconciliation, Control Room projection and explicit Safety intervention boundaries.
