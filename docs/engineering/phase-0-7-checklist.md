# Engineering Phase 0.7 Checklist

Checkpoint: Payment, Finance and Ledger Truth Foundation
Status: SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / CHARGING DISABLED / DATABASE AND APP RUNTIME UNVERIFIED

## Source implementation

- [x] Provider-neutral `PaymentIntent` and distinct `Payment` persistence and state history.
- [x] Integer minor-unit/currency constraints with JavaScript safe-integer bounds.
- [x] No direct `CREATED → CAPTURED` transition; provider timeout maps to `STATUS_UNKNOWN` plus reconciliation.
- [x] Provider event inbox has idempotent provider/event identity and safe-payload boundary.
- [x] Raw PAN/CVV/CVC/PIN/track-data fields are rejected in domain metadata and database JSON boundaries.
- [x] Generic Finance accounts, balanced double-entry posting guard and one-currency transaction rule.
- [x] Posted ledger transactions and entries are immutable; corrections are linked reversals.
- [x] Refund, DriverEarning, Payout and payout-destination-change models remain distinct.
- [x] High-risk payout destination changes require step-up and governed review state.
- [x] Rider can prepare an intent only as Booking PAYER after `COMPLETED` with a FareAgreement.
- [x] Intent preparation is idempotent and performs no provider, Payment, ledger, earning or payout action.
- [x] Payment status forbids blind retry and provides reconciliation guidance.
- [x] Receipt fails closed until captured Payment truth exists.
- [x] Driver earnings projection never derives an earning from Rider fare or implies payout.
- [x] Rider, Driver and Control Room surfaces use explicit truth labels.
- [x] OpenAPI 0.0.7 documents the provider-disabled surface.

## Verification completed here

- [x] Phase 0.7 structural/security verifier passes.
- [x] Pure-domain tests cover payment transitions, unknown-status policy, balanced ledger, reversal and raw-secret rejection.
- [x] Node TypeScript syntax checks pass for non-JSX Phase 0.7 modules.
- [x] OpenAPI YAML parses, JSON parses and repository whitespace/error checks pass.
- [x] Existing Phase 0.1–0.6 structural and source tests remain passing.

## Not yet executed or claimed

- [ ] Run migrations 0001–0007 against PostgreSQL 16 + PostGIS and exercise posting/immutability constraints.
- [ ] Test concurrent PaymentIntent creation, provider-event deduplication, status transitions, reconciliation and ledger posting.
- [ ] Compile Fastify, Expo and Vite workspaces after installing declared workspace dependencies.
- [ ] Select, contract and approve a production payment/payout provider.
- [ ] Implement signed provider ingress, adapter calls, authorised capture/refund workflows and reconciliation workers.
- [ ] Approve chart of accounts, principal/agent treatment, tax/VAT, revenue recognition, safeguarding of funds and Driver economics.
- [ ] Complete PCI scope review, secrets/key management, fraud controls, observability, dispute/chargeback operations and incident rehearsal.
- [ ] Implement payout destination step-up, cooling-off, notification and security review execution.
- [ ] Conduct accessibility, privacy, security, accounting, legal and payment-provider certification.

This checkpoint is executable source evidence, not production readiness, permission to charge, payment certification, accounting approval, legal/tax approval or permission to pay Drivers.
