# ADR-0020: Institutional live operations and final Organisation Engine closure

- Status: Accepted for source foundation
- Date: 2026-08-31
- Blueprint authority: v0.4 §64.31–§64.74 and §70 collision resolution
- Engineering checkpoint: Phase 0.20

## Decision

Institutional live operations are a task-scoped operational lens over canonical Booking, Dispatch, Journey, Safety, Finance, Rescue, Compliance and Organisation services. They do not form a shadow trip system and do not authorise direct database editing. P0–P3 attention needs an owner, a structured next action and an attention deadline. Transport exceptions preserve canonical links and remain separate from specialised cases; `RESOLVED` records action taken and `VERIFIED` records that the intended outcome occurred.

Occurrence readiness records agreement, funding, passenger/service eligibility, contact-plan, specialist-capacity, calendar and site dimensions independently. `READY` never guarantees a Driver. Manual Dispatch and partner overflow apply the same current Driver, vehicle, accessibility, safeguarding and service controls as ordinary Dispatch. A capacity failure becomes explicit `NO_ELIGIBLE_DRIVER` or an owned exception rather than an endless search or forced assignment.

Each Booking retains the agreement, policy, billing, funding and approval versions used for its execution. School handover failure blocks ordinary completion and opens P1 safeguarding work. Hospital `PASSENGER_NOT_READY` remains distinct from no-show and Driver cancellation. Authority funding expiry affects future service, does not invent statutory eligibility and never creates passenger personal liability. Employer and guest visibility is purpose-bound, minimal and time-scoped.

Live changes return to canonical reauthorisation. Canonical outcome classification cannot be rewritten for charging or SLA performance. A breakdown keeps one Booking and Journey while passenger continuity and vehicle rescue proceed in parallel. Organisation users cannot suppress, downgrade or close Safety cases. Compliance evidence prefers scoped attestations; critical data-quality issues block occurrence generation or Dispatch rather than inviting operator guesses.

Site disruptions are structured and scoped; a geofence is not absolute proof and one closure does not destroy a recurring series. Partner overflow retains canonical DAZAT truth and minimum necessary data. Degraded operation uses governed contingency records with idempotent reconciliation, never personal messages or spreadsheets as Dispatch. Security containment scopes risky capability while valid active journeys continue safely. Tracking expires with purpose; AI may assist but cannot invent authority, terminate a contract or close safeguarding.

Service health exposes versioned evidence-backed dimensions rather than a punitive mystery score and never automatically cancels Bookings. Shift handover transfers structured critical ownership. A signed contract is necessary but not sufficient for launch: operational readiness gates and any required pilot must pass or carry accountable risk acceptance. Exit inventories future and active work, governs export and access revocation, preserves lawful records and open cases, and never abandons an active passenger.

The Blueprint's final identifier collision resolution is authoritative: `ORG-AUT-002`, `ORG-HLT-002`, `ORG-PAR-001`, `ORG-SCH-005` and `ORG-SCH-006` are used instead of the earlier colliding Part 4 identifiers.

This checkpoint exposes public capabilities and authenticated tenant-scoped, privacy-minimised reads only. Institutional live commands, partner/provider execution, launch execution and all mutations remain disabled.

## Consequences

- The Organisation Engine closes with canonical-domain ownership intact.
- Live summaries can support operational awareness without exposing manifests, diagnoses, raw Safety detail or Finance detail.
- Historical decisions and classifications remain reproducible and auditable.
- PostgreSQL execution, dependency-backed compilation and real operational acceptance remain outstanding.

## Rejected alternatives

- A separate institutional Dispatch or trip ledger.
- Forced manual assignment when no eligible Driver exists.
- Treating exception resolution as proof of the intended result.
- Relabelling hospital delay, failed handover or accessibility boarding time as no-show.
- Spreadsheet or personal-message Dispatch during an outage.
- Treating a signed agreement or opaque health score as launch authority.
- Ending a relationship before every active passenger and open case has a governed disposition.
