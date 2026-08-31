# Engineering Phase 0.19 checklist

## Source foundation completed

- [x] Keep contract status separate from operational Organisation status.
- [x] Model agreement lifecycle with machine-readable effective periods and renewal risk.
- [x] Keep agreement, service policy, pricing, approval, billing, reporting and SLA records separate and versioned.
- [x] Preserve historical agreement/policy versions and prohibit silent term rewrites.
- [x] Encode legal, Safety, safeguarding, accessibility and eligibility precedence over commercial preference.
- [x] Route agreement-policy conflict and out-of-policy requests to controlled review.
- [x] Evaluate Booking, approval and funding authority independently.
- [x] Prevent approval from creating Driver assignment or bypassing Booking/Dispatch validation.
- [x] Allow governed active-passenger Safety, safeguarding and continuity action without falsifying commercial approval.
- [x] Model billing account, cost-centre/programme, funding and structured purchase-order context.
- [x] Keep billing configuration outside ledger ownership and forbid direct invoice/ledger rewriting.
- [x] Prevent organisation debt or missing funding from charging a passenger payment method.
- [x] Model prospective credit restriction, time-limited audited override and early future-Booking risk.
- [x] Keep portal tenant/role permission in the backend with Finance and safeguarding separated.
- [x] Model versioned SLA definitions, measurements, cause and data-quality limitations.
- [x] Prohibit stale GPS proof and classification/Safety suppression for SLA performance.
- [x] Keep organisation allegations as evidence rather than automatic Driver findings.
- [x] Model owned service cases and corrective actions with owner/action/deadline/evidence/outcome.
- [x] Model prospective contract change and non-writing future-Booking simulation.
- [x] Preserve completed Journeys and active transport during policy change.
- [x] Model tenant-scoped, revocable, rotated, idempotent API and signed webhook boundaries.
- [x] Keep reports/exports tenant-, role-, purpose- and step-up scoped.
- [x] Preserve canonical event classification and Finance-owned contractual remedies.
- [x] Model scoped suspension/termination, future disposition and non-destructive retention.
- [x] Revalidate agreement, credit, security, documents, contacts and credentials on reinstatement.
- [x] Model dry-run, row-level migration with current eligibility revalidation and no legacy bypass.
- [x] Catalogue twelve API domains, ten commands, sixteen events, twenty P0 requirements and nineteen acceptance cases.
- [x] Expose public disabled capabilities and authenticated actor-owned aggregate commercial context only.
- [x] Add Organisation Portal and Control Room Part 3 truth surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verifier and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0019 against PostgreSQL/PostGIS and exercise trigger, tenant, uniqueness and concurrency behaviour.
- [ ] Compile or run Fastify/Vite workspaces with installed dependencies.
- [ ] Create, approve, activate, vary, suspend, terminate or reinstate a real agreement.
- [ ] Execute a real Booking approval, billing, credit, service-credit, contract simulation, export or migration command.
- [ ] Create or rotate a production API credential or deliver a real webhook.
- [ ] Approve legal terms, pricing, credit, invoicing, SLA, remedy, renewal or exit policy.
- [ ] Import real organisation, passenger, roster, school, hospital, funding or scheduled-transport data.
- [ ] Claim production Finance, privacy, security, safeguarding, accessibility, tenancy, legal or operational acceptance.

## Stop conditions retained

- No commercial contract overrides legal, Safety, safeguarding, accessibility or platform hard rules.
- No agreement document silently becomes operational policy or pricing/ledger truth.
- No approval creates a Driver assignment or bypasses current canonical validation.
- No cost centre, funding code or PO edits ledger truth.
- No organisation debt or missing funding charges a passenger personal method.
- No active passenger is stranded by credit, suspension, expiry or termination.
- No SLA or remedy rewrites canonical Safety, no-show, lateness or conduct classification.
- No organisation allegation creates automatic guilt or punishment.
- No policy simulation writes production state or mutates completed/active transport.
- No integration bypasses tenant, scope, signing, idempotency, privacy or audit.
- No export becomes passenger surveillance or cross-tenant disclosure.
- No legacy migration flag bypasses current eligibility, security or safeguarding.
- No organisation commercial mutation or external execution at this checkpoint.
