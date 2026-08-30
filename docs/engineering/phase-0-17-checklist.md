# Engineering Phase 0.17 checklist

## Source foundation completed

- [x] Model one typed Organisation identity and staged lifecycle with recorded transition provenance.
- [x] Separate versioned legal profile, sites, cost centres and purpose-specific contacts.
- [x] Enforce backend tenant isolation using authenticated person plus current active membership.
- [x] Model membership lifecycle, scoped invitations and staff-departure revocation evidence.
- [x] Define granular role families and permissions with no universal administrator.
- [x] Require step-up, four-eyes and permitted Shield decisions for high-risk administration.
- [x] Keep SSO authentication separate from DAZAT authorisation.
- [x] Keep booker, passenger and payer distinct and prohibit organisation ownership of passenger identity.
- [x] Model purpose-bound passenger roster entries without inferring consent, lawful basis or safeguarding authority.
- [x] Model versioned BookingAuthorityRule and funding instruction separately from membership.
- [x] Preserve accessibility, universal Safety and school safeguarding above organisation service/cost policy.
- [x] Keep cost-centre allocation separate from Finance ledger, invoice, payment and refund truth.
- [x] Model versioned approval rules and require reapproval after material Booking/quote changes.
- [x] Permit safety-driven active-Journey handling without waiting for ordinary corporate approval.
- [x] Model scoped restrictions that never terminate active Journeys or create passenger/Driver findings.
- [x] Model agreements, communication policies and support links without replacing canonical owners.
- [x] Model tenant/environment/permission-scoped API clients, credential rotation and signed replay-safe webhooks.
- [x] Prohibit webhook delivery failure from mutating canonical Booking state.
- [x] Model role-, purpose- and time-bounded exports with sensitive-data minimisation.
- [x] Model non-destructive offboarding and later reactivation rechecking.
- [x] Catalogue twelve conceptual APIs, twenty core events, twelve P0 requirements and fourteen acceptance cases.
- [x] Expose public disabled capabilities and authenticated actor-owned organisation/context reads only.
- [x] Add Organisation Portal and Control Room authority-boundary surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verifier and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0017 against PostgreSQL/PostGIS and exercise constraints, triggers and tenant-query plans.
- [ ] Compile and run Fastify, Vite and workspace packages with installed dependencies.
- [ ] Implement organisation creation, verification, invitation, membership, role, policy, approval, roster, agreement, restriction, export or offboarding commands.
- [ ] Select or enable SSO, company registry, credit-check, e-signature, accounting, API gateway or webhook providers.
- [ ] Approve legal status, contracting authority, safeguarding authority, lawful basis, tax treatment or credit policy for any real organisation.
- [ ] Seed real agreements, passengers, roles, policies, credentials, webhooks, exports or organisation staff.
- [ ] Enable API credentials, webhook delivery, bulk upload, report export or staff mutations.
- [ ] Claim production tenant-isolation, penetration, privacy, accessibility, safeguarding or operational acceptance.

## Stop conditions retained

- No client-enforced tenant isolation and no access merely from an organisation or Booking identifier.
- No universal organisation administrator or SSO-derived permission.
- No membership, roster or contact record used as passenger ownership, consent or safeguarding authority.
- No organisation policy can weaken universal Safety, accessibility or school safeguarding.
- No cost centre may become Finance ledger truth.
- No organisation restriction can strand an active passenger or become a misconduct finding.
- No unrelated sensitive passenger, Safety, location, card or clinical export.
- No webhook failure may change canonical Booking state.
- No destructive deletion of passenger identity or lawful canonical history during offboarding.
- No portal/staff mutation, export execution, API credential use or external integration execution.
