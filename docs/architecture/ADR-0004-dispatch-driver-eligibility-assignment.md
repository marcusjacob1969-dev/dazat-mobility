# ADR-0004 — Driver eligibility, availability and atomic assignment foundation

Status: **Accepted for Engineering Phase 0.4**

Implementation evidence: **source, static verification and pure-domain test design; PostgreSQL/API/mobile concurrency runtime evidence remains pending**.

## Decision

1. A verified Driver account is identity authority only. It never proves licensing, insurance, vehicle, training, service or current operating eligibility.
2. Compliance owns append-only Driver and vehicle eligibility snapshots with policy version, expiry, blockers and evidence references. Dispatch consumes those snapshots but cannot create or override them.
3. A Driver may enter the candidate pool only when account, Driver approval, compliance, authorised vehicle, vehicle eligibility, availability, fresh-enough location, active-assignment, schedule-conflict and Booking hard-requirement checks all pass.
4. Ordinary Driver-app location is cleared when the Driver goes `OFFLINE`. Separately governed fleet telematics is not silently treated as Driver-app availability.
5. Provisional straight-line pickup distance may rank already eligible candidates in this checkpoint. It is explicitly not a road-time ETA and must never be shown as an invented arrival promise.
6. Offers contain decision-relevant pickup/drop-off/schedule context, expire, and are not ordinary acceptance-rate punishment when declined or allowed to expire.
7. Accepting an offer locks the DispatchAttempt, revalidates Driver eligibility and Booking state, inserts one active DriverAssignment, withdraws competing offers, changes Driver availability and transitions Booking to `DRIVER_ASSIGNED` in one database transaction.
8. Partial unique indexes enforce one active assignment per Booking and one active assignment per Driver. The losing concurrent acceptance receives a safe conflict rather than a second assignment.
9. Exhausting the hard-filter pool produces explicit `NO_ELIGIBLE_DRIVER`; the platform does not spin forever or invent a Driver/ETA.
10. Control Room cannot bypass the eligibility engine. Manual selection and wider search are later authorised commands that must re-run the same hard filters and remain auditable.

## Consequences

- `DSP-001` and `DRV-CMP-001` now have source-level implementation evidence.
- The first Rider/Driver slice can advance from `READY_FOR_DISPATCH` to truthful search/no-driver/assignment states.
- Compliance approval workflows, real vehicle onboarding, road-time ranking, scheduled-conflict protection and full Control Room intervention remain later checkpoints and are not claimed here.
