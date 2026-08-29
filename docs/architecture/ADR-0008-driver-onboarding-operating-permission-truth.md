# ADR-0008: Driver Onboarding and Scoped Operating Permission Truth

Status: Accepted for Engineering Phase 0.8 source checkpoint
Date: 2026-08-29

## Context

Phase 0.4 introduced append-only compliance and vehicle eligibility snapshots for Dispatch, but it deliberately did not define how a person becomes an approved Driver or gains a scoped operating permission. Authentication, a submitted document, OCR output, training attendance, application approval, selected-vehicle eligibility and availability are different facts. Collapsing them would allow self-approval, stale evidence, a broad restriction where a narrow one is intended, or an online state that bypasses current operating authority.

No production identity-verification provider, licensing interpretation or region/service policy has been selected or approved. The foundation must therefore preserve evidence and authority boundaries without inventing those rules.

## Decision

1. `DriverApplication` is resumable and versioned. It follows guarded states from `STARTED` through contact, identity, document, training, vehicle and authorised review stages. Only `REVIEW_PENDING` can reach `APPROVED`, and a terminal approval/decline requires a separate immutable authorised decision record.
2. The Driver self-service command can create/resume an application and recognise an already-authoritative verified contact. It cannot set identity, document, training, vehicle, review, permission, restriction or approval truth.
3. `DriverProfile.onboarding_status` is a projection of the latest application, not a second editable approval source. Deferred database guards require profile, application and append-only transition history to agree at commit.
4. Documents retain opaque storage reference, integrity hash, lifecycle and extraction metadata. OCR/extraction is permanently non-authoritative. `VERIFIED` requires a separate immutable review by authorised staff or a future approved provider.
5. Requirement definitions are versioned by region and service. This checkpoint stores no invented licensing thresholds or jurisdiction rules.
6. Training modules are versioned. Attendance is not competency. A high-risk module requires assessment, and a passing record requires authority, score/evidence at or above the versioned pass mark, competency confirmation and current validity.
7. Operating permissions are explicit by Driver, region and service. High-risk permission validity cannot outlive the assessed competency evidence that grants it, and active validity windows may not overlap.
8. Restrictions are narrow: all services, school, WAV, new journeys, payout or a specific vehicle. A matching selected-vehicle restriction blocks that vehicle; school/WAV restrictions filter only matching service permissions. A payout-only restriction does not silently become an operating ban. Precautionary restrictions are not misconduct findings.
9. Operating eligibility is derived from active account, approved application, current compliance, selected-vehicle presence/authorisation/eligibility, current service permissions and applicable restrictions. It returns `ELIGIBLE`, `PARTIALLY_ELIGIBLE` or `NOT_ELIGIBLE` with explicit blockers.
10. Availability is evaluated separately. Neither application approval nor an operating permission places a Driver online or makes them dispatchable.
11. Going online, candidate selection and offer acceptance all revalidate current region/service permission, high-risk competency and applicable restrictions. Candidate evidence retains the permission/restriction IDs used by the hard filter.

## Consequences

- The source establishes a fail-closed authority model without selecting an external verification provider or encoding unapproved regional licensing policy.
- Historical applications, decisions, documents, training attempts, permission validity and eligibility snapshots can be retained rather than overwritten into an unexplained boolean.
- Driver and Control Room surfaces can explain the current boundary while exposing no approval or compliance-authority mutation route; Dispatch fails closed against the new permission truth.
- PostgreSQL migration/runtime, concurrency, authorised staff/provider workflows, evidence storage/scanning, policy configuration and compliance/legal/security review remain required before production onboarding.
