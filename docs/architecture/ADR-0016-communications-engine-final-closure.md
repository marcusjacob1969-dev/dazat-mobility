# ADR-0016: Communications Engine final closure

- Status: Accepted for source foundation
- Date: 2026-08-30
- Blueprint authority: v0.4 §59.1–§59.16
- Engineering checkpoint: Phase 0.16

## Decision

Close Communications Parts 1–4 behind one canonical, provider-neutral engineering contract. Communications owns recipient resolution, channel and template policy, delivery attempts, fallback, acknowledgement, protected contact, telephony/voice orchestration, channel health and communications-specific abuse controls. It does not own or invent Booking, Journey, Safety, School, Finance, Driver, Fleet, Support or Shield decisions.

Every source-domain request must resolve through an immutable versioned event envelope and a canonical request contract. The request carries an idempotency key, source event, authoritative recipient reference and role, explicit purpose and priority, approved template and payload variables, source-state version, data classification, acknowledgement rule, fallback-policy version and correlation identifier. Raw destination details and arbitrary source aggregates are not accepted from product modules.

The fourteen named P0/P1 event types, fifteen conceptual API operations and twenty P0 requirement IDs are explicit versioned catalogues. Catalogue presence documents the contract; it does not mean a mutation endpoint or production integration is implemented.

Recipient permission is resolved before channel selection. Passenger, booker, payer, guardian/carer, school, Driver, organisation, Control Room, Safety and partner/rescue scopes remain distinct. Priority affects latency and fallback; it never expands data access. Operators require an active task and cannot browse unrelated sensitive communication history.

Delivery routing follows the blueprint order: current source state; role permission; purpose/priority/classification; valid contact points; accessibility/language/quiet-hours; unsafe-channel exclusion; active Notification/Fallback Policy; primary attempt and separate delivery evidence; policy-authorised, state-revalidated fallback; then stop, complete or owned failure-case escalation. Provider acceptance and `SENT` are not delivery.

Degraded operation is explicit. Recovery discards duplicate and stale events. Shield unavailability pauses high-risk account or financial changes while essential canonical Journey, Safety and safeguarding work remains available. Only an approved safe alternate may be used.

The eighteen end-to-end acceptance scenarios and thirteen launch gates are first-class, versioned evidence. Passing source tests cannot enable a provider, a staff command, a real-user scenario or a pilot. Production policy, provider/procurement, staffing, security, accessibility, privacy/retention and operational approvals remain separate accountable gates.

## Consequences

- Communications APIs expose only capability, recipient-scoped status and launch-evidence reads in this checkpoint.
- Conceptual mutation APIs in the blueprint remain unimplemented and fail closed.
- Source domains cannot call providers directly or treat endpoint reachability as authority.
- Event, request, permission, route, degraded-mode, acceptance and launch evidence is append-only.
- The application explicitly reports that provider execution, closure mutations and pilot launch are disabled.
- PostgreSQL execution, workspace compilation and production-like acceptance drills remain unverified until their dependencies and accountable approvals exist.

## Rejected alternatives

- Let each product module call SMS, email, push or voice providers directly.
- Copy whole source aggregates into message payload storage.
- Treat urgent priority as permission to disclose more data.
- Treat provider acceptance, `SENT`, transcript text, caller ID or contact verification as broader authority.
- Replay queued messages after recovery without current-state and duplicate checks.
- Mark the system launch-ready because structural tests pass.
