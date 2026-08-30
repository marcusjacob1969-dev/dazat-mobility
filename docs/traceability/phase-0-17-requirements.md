# Phase 0.17 Organisation Operations Part 1 traceability

| Blueprint §61 requirement / invariant | Source implementation | Status |
|---|---|---|
| One typed Organisation model | `ORGANISATION_TYPES` and `organisation.organisation` | SOURCE_TESTED |
| Staged lifecycle with evidence | lifecycle evaluator, transition table and deferred guard | SOURCE_TESTED |
| Legal profile is versioned and not inferred | legal-profile versions and hard constraints | SOURCE_TESTED |
| Organisation, site and cost centre remain distinct | versioned site/cost-centre records | SOURCE_TESTED |
| Tenant isolation is a backend invariant | tenant evaluator and authenticated SQL predicates | SOURCE_TESTED |
| Cross-organisation access needs governed platform authority | tenant evaluator audit/relationship gates | SOURCE_TESTED |
| Membership has explicit lifecycle and validity | membership state catalogue and guarded evidence | SOURCE_TESTED |
| Granular roles and permissions; no universal admin | role/permission catalogues and hard-false field | SOURCE_TESTED |
| Finance authority is not safeguarding authority | capability evaluator and separate permissions | SOURCE_TESTED |
| High-risk administration requires stronger controls | step-up, four-eyes and Shield gates | SOURCE_TESTED |
| Invitations are purpose- and recipient-bound | invitation evaluator and guarded record | SOURCE_TESTED |
| SSO authenticates but does not grant permission | hard-false domain and API boundary | SOURCE_TESTED |
| Booker, passenger and payer remain distinct | booking-authority evaluator | SOURCE_TESTED |
| Organisation does not own passenger identity | hard-false domain/database/API truth | SOURCE_TESTED |
| Roster is not consent, lawful basis or authority | roster hard constraints | SOURCE_TESTED |
| Booking authority is separate from membership | versioned rule plus evaluator | SOURCE_TESTED |
| Service policy cannot weaken accessibility or Safety | policy evaluator and immutable true constraints | SOURCE_TESTED |
| School safeguarding remains an independent scope | permission/policy gates | SOURCE_TESTED |
| Contacts are purpose-specific | contact-purpose catalogue and versions | SOURCE_TESTED |
| Cost centre is not Finance ledger | hard-false domain/database/API truth | SOURCE_TESTED |
| Funding instruction format is explicit | immutable funding instruction | SOURCE_TESTED |
| Approval binds Booking and quote versions | approval evaluator and guarded request | SOURCE_TESTED |
| Material changes require reapproval | evaluator and immutable true constraint | SOURCE_TESTED |
| Safety-driven active-Journey action is not delayed | policy and approval rule truth | SOURCE_TESTED |
| Agreements are immutable versions | agreement version plus close-only guard | SOURCE_TESTED |
| Restrictions are scoped and do not strand journeys | restriction evaluator and hard constraints | SOURCE_TESTED |
| Support links do not replace canonical cases | support-case boundary | SOURCE_TESTED |
| API clients are tenant/environment/permission scoped | API client and credential records | SOURCE_TESTED |
| Webhooks are signed, replay-safe and idempotent | integration evaluator, delivery and command dedup | SOURCE_TESTED |
| Webhook failure cannot mutate Booking | hard-false domain/database/API truth | SOURCE_TESTED |
| Exports are role/purpose/time scoped and minimised | export evaluator and exclusion constraints | SOURCE_TESTED |
| Bulk flows require validation and error isolation | conceptual boundary; execution disabled | NOT_IMPLEMENTED |
| Offboarding revokes authority without identity/history deletion | offboarding evaluator and immutable evidence | SOURCE_TESTED |
| Twelve conceptual APIs are catalogued | conceptual path constant and capability projection | SOURCE_TESTED |
| Twenty core events are versioned | event catalogue and append-only event table | SOURCE_TESTED |
| Twelve P0 requirement IDs are explicit | requirement constant and capability projection | SOURCE_TESTED |
| Fourteen acceptance cases are explicit | acceptance constant and versioned table | SOURCE_TESTED |
| Portal exposes no direct database editor | hard-false capability and read-only routes | SOURCE_TESTED |
| Mutations and external integrations remain disabled | configuration, UI and route boundaries | SOURCE_TESTED |
