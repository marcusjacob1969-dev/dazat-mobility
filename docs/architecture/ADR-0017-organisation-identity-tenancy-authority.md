# ADR-0017: Organisation identity, tenancy and authority foundation

- Status: Accepted for source foundation
- Date: 2026-08-30
- Blueprint authority: v0.4 §61.1–§61.54
- Engineering checkpoint: Phase 0.17

## Decision

Model every business, school, authority, healthcare, care, community and partner account through one Organisation aggregate with an explicit type and staged lifecycle. Organisation identity, legal profile, operating sites and cost centres are separate records. Profiles, policies, agreements, approval rules and authority rules are immutable versions; material state changes retain actor, reason, effective time and approval evidence.

The organisation layer governs booking, funding, administration and reporting. It is not a second Booking engine and never owns a passenger. Booker, passenger and payer remain distinct canonical Booking parties. Roster membership is a purpose-limited relationship, not consent, lawful basis, safeguarding authority or identity ownership. Booking authority requires a current organisation and membership, granular permission, active versioned authority rule, authorised passenger population, permitted service/site/cost-centre scope, current agreement and any required funding instruction.

Tenant isolation is enforced by backend queries using the authenticated person and a current active membership. Client identifiers, SSO assertions or knowledge of a Booking ID do not grant access. Roles are granular and there is no universal administrator. High-risk role, credential, export and administrative work requires step-up and, where policy requires, four-eyes evidence plus a permitted Shield decision.

Organisation policy may narrow ordinary service or funding choices but cannot disable universal Safety, accessibility or school safeguarding. Finance owns ledger, invoice, payment and refund truth; cost centres remain allocation and reporting context. Restrictions are scoped and cannot terminate an active Journey or create a passenger/Driver finding.

API clients and webhook subscriptions are tenant-, environment- and permission-scoped, signed, replay-safe and idempotent. Delivery failure cannot mutate canonical Booking state. Exports are role-, purpose- and time-bounded and exclude unrelated passenger journeys, raw Safety evidence, raw location traces, card data and clinical detail. Offboarding revokes organisation authority without deleting lawful passenger identity or canonical history.

This checkpoint exposes only a public capability projection, an authenticated actor-owned organisation list and an authenticated actor-owned tenant context. All portal/staff mutations, export execution, external API credentials and webhook delivery remain disabled.

## Consequences

- One lifecycle and role model supports all listed organisation types without implying identical legal powers.
- Every authenticated tenant read derives authority server-side from a current active membership.
- Sites and cost centres narrow access without becoming legal organisations or Finance ledgers.
- Organisation users cannot bypass Booking, Journey, Safety, School, Finance, Communications, Support or Shield owners.
- Historic agreements, decisions, restrictions, approvals and audit evidence remain preserved.
- PostgreSQL execution, workspace compilation and production-like tenancy/security tests remain unverified until dependencies and accountable approvals exist.

## Rejected alternatives

- A separate booking engine or copied passenger identity per organisation.
- A universal organisation-admin flag.
- Client-side tenant filtering or access based on a URL identifier.
- Treating SSO authentication as DAZAT permission.
- Treating roster membership as consent or authority.
- Letting organisation cost policy override accessibility, Safety or safeguarding.
- Using cost centres as ledger or invoice truth.
- Executing portal edits, exports, APIs or webhooks because their conceptual contracts exist.
