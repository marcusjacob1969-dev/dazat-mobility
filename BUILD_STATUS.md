# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.7 — Payment, Finance and Ledger Truth Foundation**

Status: **SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / CHARGING DISABLED / DATABASE, CONCURRENCY AND APP RUNTIME NOT YET VERIFIED**

DAZAT is being built cleanly from the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository.

### Implemented source

- All Phase 0.1–0.6 monorepo, Identity, Booking, Dispatch, Journey, Safety and governed-completion foundations.
- Guarded active Journey spine: `IN_PROGRESS → ARRIVING → COMPLETED`.
- Append-only, purpose-scoped active telemetry with connectivity confidence and movement-plausibility classification.
- Authoritative reconnect snapshot with Journey health, pending changes and completion requirements.
- Append-only Journey event timeline and contextual route-deviation evidence.
- Governed stop/destination requests that remain pending and do not fabricate route application, pricing or Driver acknowledgement.
- Transactional SOS, Silent Assistance and route-concern persistence with restricted outbox delivery.
- Hard Silent Assistance `DO_NOT_AUTO_CALL` policy and no external provider dependency for canonical persistence.
- Database-constrained rule that route concerns do not create automatic misconduct findings.
- Fresh, accurate, confident, movement-plausible destination-approach evidence.
- Service-context completion requirements with fail-closed authorised-handover gate.
- Atomic Journey, Booking, leg and assignment completion plus Driver `ASSIGNED → AVAILABLE` release.
- Provider-neutral PaymentIntent and distinct Payment state/history.
- Fail-closed `PAYMENT_PROVIDER_MODE=disabled`; no provider adapter or charging call.
- Rider intent preparation only after governed completion and only from immutable FareAgreement truth.
- `STATUS_UNKNOWN` reconciliation model with blind retry forbidden.
- Idempotent provider-event inbox boundary with signature state and payload hash.
- Integer minor-unit/currency constraints and raw payment-secret field rejection.
- Balanced, same-currency, append-only ledger posting with linked reversal corrections.
- Separate Refund, DriverEarning, Payout and high-risk payout-destination-change models.
- Receipt projection only from captured Payment truth.
- Rider, Driver and Control Room Finance surfaces with explicit no-charge/no-inferred-earning labels.

### Verified in this checkpoint

- Earlier structural verifiers and source tests remain available through Phase 0.6.
- Phase 0.7 provider-disablement, payment, money, ledger, reconciliation and projection verifier: **PASSED**.
- Pure-domain tests cover guarded payment transitions, unknown-status policy, balanced minor-unit ledger entries, reversal construction and recursive raw-secret rejection.
- Blueprint traceability for `PAY-006`, `FIN-DAT-001`, `PAY-UNK-001`, `PAY-EAR-001`, `PAY-SUB-001`, `PAY-BRK-001` and `PAY-DSP-001`: **recorded**.

### Not yet verified / deliberately not claimed

- PostgreSQL/PostGIS migrations 0001–0007 and transaction/concurrency cases have not been executed in this workspace.
- Fastify, Expo and Vite workspaces have not been compiled with installed workspace dependencies here.
- Authorised school/hospital/specialist handover recording is not exposed until staff and operating-authority rules are implemented.
- Production payment provider selection, adapter/webhook/reconciliation execution, refunds and payouts are not implemented.
- Chart of accounts, principal/agent status, tax/VAT, revenue recognition and Driver economics await accountable approval.
- PCI scope, fraud, dispute/chargeback, secrets, observability and payment incident controls require formal validation.
- Telemetry thresholds/radii and retention defaults await Operations, Safety, privacy, accessibility and safeguarding validation.
- No production Driver, vehicle, passenger, location, Safety, pricing, provider credentials or data are present.
- Source creation is not production readiness, safeguarding approval, licensing approval, insurance cover, payment certification or security certification.

## Founder/procurement gate

Selecting, contracting and enabling a production payment/payout provider remains a founder-level decision. The provider-neutral foundation can continue safely, but no charging, refund, settlement or payout path may be enabled before that decision and the required legal, accounting, security and operational controls.
