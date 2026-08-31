# ADR-0018: Institutional passenger and recurring transport foundation

- Status: Accepted for source foundation
- Date: 2026-08-31
- Blueprint authority: v0.4 §63.1–§63.59
- Engineering checkpoint: Phase 0.18

## Decision

Institutional transport uses the canonical Booking, Dispatch, Journey, Safety, School, Finance and Communications engines. Organisation rosters, authority, funding, templates, recurrence, calendars, readiness and bulk batches prepare or constrain transport; they never form a second booking engine or shadow passenger database.

Passenger identity exists independently of every organisation relationship. A ManagedPassengerProfile contains only the minimum transport information available to that tenant and uses a tenant-local reference. OrganisationPassengerMembership records purpose, authority basis and validity. Ending it revokes future authority and applies an explicit future-Booking disposition without deleting the passenger, another tenant relationship or lawful history.

Booking authority and funding authority are independently evaluated. Missing or expired organisation funding opens a controlled approval/funding exception; it never silently creates passenger personal liability. Service eligibility uses structured transport requirements rather than diagnoses and is re-evaluated at Booking creation, Dispatch and reassignment. Accessibility, safeguarding and handover requirements survive every recurrence, amendment and breakdown.

BookingTemplate and BookingSeries are versioned preparation objects. Every generated occurrence references its template, agreement, policy, funding context and one unique canonical Booking. Templates reserve no Driver and create no Finance liability. Generation is horizon-limited and uses structured recurrence plus versioned calendars. Amendments explicitly target one occurrence, this-and-future occurrences or the permitted whole series. Completed Bookings remain immutable and active Journeys use canonical amendment rules.

School continuity is a ranking preference only after current Driver, vehicle, licence, training, accessibility and safeguarding eligibility. Capacity reservation is capability-aware and schedule conflict checks include active assignments, scheduled work, travel time, maintenance, fatigue/rest and service commitments.

ReadyForPickup preserves NOT_READY and READY as current versioned observations. NOT_READY is not an automatic no-show, and flexible windows never claim guaranteed instant collection. Cancellation remains a reason-coded canonical Booking transition; contractual charges remain Finance policy.

Bulk passenger and Booking batches require dry-run validation, deterministic row-level outcomes, tenant-safe duplicate detection and idempotent commit. Partial commit is available only under explicit policy with every row outcome visible. Passenger substitution rechecks authority, service requirements, funding, Communications and RideCheck rules; active-Journey relabelling is prohibited.

This checkpoint exposes only a public capability projection and an authenticated actor-owned institutional context with counts and open exception summaries. All institutional commands, external execution and direct Journey/Payment writes remain disabled.

## Consequences

- One person may have multiple tenant-isolated organisation relationships.
- Each actual occurrence retains independent Booking state and audit history.
- Institutional exceptions remain owned work and do not absorb Safety or School authority.
- Reports remain tenant-, role- and purpose-scoped and exclude raw Safety, diagnoses, Driver-private and unrelated history by default.
- PostgreSQL execution, workspace compilation, concurrency and production tenant/security validation remain outstanding.

## Rejected alternatives

- Copying a passenger identity into each organisation tenant.
- Treating a roster, template or series as a Booking.
- Generating years of occurrences without a controlled horizon.
- Letting a familiar Driver preference override current eligibility.
- Treating hospital/care NOT_READY as an ordinary no-show.
- Hiding malformed rows or cross-tenant duplicates in bulk processing.
- Relabelling an active Journey passenger through portal metadata.
- Calculating contractual cancellation charges in the organisation portal.
