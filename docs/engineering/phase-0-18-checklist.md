# Engineering Phase 0.18 checklist

## Source foundation completed

- [x] Keep passenger identity independent of organisation roster and funding relationships.
- [x] Model minimum-data ManagedPassengerProfile with tenant-local reference and no default diagnosis.
- [x] Model purpose/evidence-bound OrganisationPassengerMembership with explicit lifecycle.
- [x] Preserve identity, other tenant relationships and lawful history when membership ends.
- [x] Model scoped PassengerAuthorisedContact without automatic finance, recovery or history access.
- [x] Evaluate Booking authority and funding authority independently.
- [x] Prevent missing organisation funding from becoming passenger personal liability.
- [x] Model versioned FundingAuthorisation as allowance/context, never stored money or ledger truth.
- [x] Model structured service eligibility and recheck at Booking, Dispatch and reassignment.
- [x] Preserve accessibility, school safeguarding and handover through recurrence and reassignment.
- [x] Keep diagnosis/clinical history outside default hospital and care transport data.
- [x] Model versioned BookingTemplate and immutable BookingSeries amendment provenance.
- [x] Generate one independently auditable canonical Booking for every occurrence.
- [x] Retain template, agreement, policy and funding versions on every occurrence/provenance record.
- [x] Limit generation horizon and require structured recurrence/calendar versions.
- [x] Separate one-occurrence, future-occurrence and whole-series change scopes.
- [x] Protect completed Bookings and active Journeys from series edits.
- [x] Model structured school/term dates, closures and exceptions.
- [x] Keep familiar Driver continuity below current Driver/vehicle hard eligibility.
- [x] Preserve school handover rules per occurrence.
- [x] Model capability-aware capacity and complete Driver schedule conflict assessment.
- [x] Model flexible pickup windows without guaranteed-instant claims.
- [x] Keep passenger NOT_READY distinct from no-show and use authoritative current readiness.
- [x] Model dry-run, row-level, tenant-safe and idempotent passenger/Booking bulk batches.
- [x] Prohibit ambiguous silent partial results and cross-tenant duplicate disclosure.
- [x] Revalidate passenger substitution; prohibit active-Journey relabelling.
- [x] Keep institutional cancellation canonical and Finance-owned for charges.
- [x] Model owned OrganisationTransportException with status evidence and canonical links.
- [x] Preserve institutional Booking provenance and prohibit direct Journey/Payment writes.
- [x] Catalogue ten API domains, fifteen commands, eighteen events, nineteen P0 requirements and eighteen acceptance cases.
- [x] Expose public disabled capabilities and authenticated actor-owned institutional context reads only.
- [x] Add Organisation Portal and Control Room Part 2 truth surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verifier and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0018 against PostgreSQL/PostGIS and exercise tenant, trigger, uniqueness and concurrency behaviour.
- [ ] Compile or run Fastify/Vite workspaces with installed dependencies.
- [ ] Create or expose roster, authority, funding, template, series, readiness, batch, cancellation or exception commands.
- [ ] Generate or change a real canonical Booking from an institutional object.
- [ ] Import real school, hospital, care, authority, employee or visitor passenger data.
- [ ] Approve statutory eligibility, clinical-data handling, school calendars, no-show/waiting rules, funding limits or cancellation charges.
- [ ] Reserve real capacity, select Drivers/vehicles or claim pickup guarantees.
- [ ] Enable external files, APIs, webhooks, bulk commits or report exports.
- [ ] Claim production privacy, safeguarding, accessibility, tenancy, security or operational acceptance.

## Stop conditions retained

- No organisation ownership, deletion or cross-tenant disclosure of passenger identity/relationships.
- No membership alone proves authority to book or fund transport.
- No missing organisation funding silently becomes passenger personal liability.
- No template/series becomes a Booking, Driver reservation, Journey or Finance liability.
- No occurrence exists without its own canonical Booking and generation provenance.
- No series edit changes completed Bookings or active Journeys.
- No accessibility, safeguarding or handover downgrade through recurrence, reassignment or breakdown.
- No familiar Driver preference overrides current hard eligibility.
- No PASSENGER_NOT_READY automatically becomes no-show.
- No malformed bulk row, replay or duplicate creates an ambiguous result.
- No portal passenger substitution on an active Journey.
- No portal-owned cancellation charge or direct Journey/Payment write.
- No institutional mutation or external execution at this checkpoint.
