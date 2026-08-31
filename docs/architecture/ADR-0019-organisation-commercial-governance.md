# ADR-0019: Organisation commercial governance foundation

- Status: Accepted for source foundation
- Date: 2026-08-31
- Blueprint authority: v0.4 §64.1–§64.30
- Engineering checkpoint: Phase 0.19

## Decision

Organisation agreements shape authority, funding, permitted service, reporting and contractual treatment without replacing canonical Booking, Dispatch, Journey, Safety or Finance truth. Agreement documents, operational service policies, pricing schedules, approval policies, billing policies, reporting policies and service-level definitions are independently versioned and effective-dated. Contract status remains separate from operational Organisation status.

Policy precedence is fixed: legal/regulatory rules; Safety, safeguarding and accessibility; current platform Driver/vehicle/service eligibility; organisation Booking authority; passenger/service eligibility; funding/approval; commercial preference; then pricing/billing treatment. A commercial policy may narrow ordinary service but never downgrade a hard requirement. Agreement-policy conflict opens controlled review.

Approval authority, Booking authority and funding authority remain separate. Approval never confirms a Booking or assigns a Driver. Active-passenger Safety, safeguarding and breakdown continuity may proceed under recorded governed emergency authority while Finance reconciles the commercial exception later.

Billing accounts, cost centres, programmes, purchase orders and structured funding references provide allocation context to the canonical Finance Engine. They are not ledger accounts and cannot edit invoices, fares or ledger history. Missing organisation funding never creates passenger personal liability. Credit restriction is prospective to new ordinary work and cannot strand an active passenger.

Service-level evidence retains the metric definition, population, window, target, evidence source, data-quality limitations and cause. Targets are not guarantees, stale GPS is not proof, and Safety/classification truth cannot be rewritten for performance. Organisation allegations remain evidence and use canonical Safety, Support or Conduct review without automatic guilt.

Contract changes are prospective and simulate every affected future Booking before activation without production writes. Completed Journeys remain unchanged and active Journeys cannot be invalidated. API/webhook credentials remain tenant-scoped, revocable, idempotent, signed and privacy-minimised. Exports remain role/purpose-scoped and audited.

Suspension, termination and reinstatement classify future Bookings, preserve active continuity and retain lawful Finance, Safety, safeguarding and audit history. Reinstatement revalidates agreement, credit, security, documents, contacts and credentials. Migration is dry-run, row-level and cannot trust legacy approval or safety flags as current DAZAT eligibility.

This checkpoint exposes only public commercial capabilities and an authenticated actor-owned aggregate context. Commands, external integrations, exports, migration commits, service-credit execution and all commercial mutations remain disabled.

## Consequences

- Historical transport stays reproducible under the agreement, policy and SLA versions in force.
- Commercial exception handling never falsifies approval or canonical event classification.
- Organisation Portal and Control Room remain read-only clients over backend tenant authority.
- PostgreSQL execution, workspace compilation, production policy, provider and operational validation remain outstanding.

## Rejected alternatives

- Hard-coding signed contract terms into portal behaviour.
- Treating approval as Booking confirmation or Dispatch assignment.
- Charging a passenger payment method for organisation debt or missing PO data.
- Rewriting no-show, lateness, Safety or conduct truth for an SLA or charge.
- Applying contract changes retroactively to completed or active transport.
- Restoring old API credentials blindly after reinstatement.
- Importing legacy approved/safe flags as current eligibility truth.
