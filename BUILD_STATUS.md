# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.8 — Driver Onboarding, Competency, Compliance and Scoped Operating Permission Truth**

Status: **SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / EXTERNAL VERIFICATION AND CHARGING DISABLED / DATABASE, CONCURRENCY AND APP RUNTIME NOT YET VERIFIED**

DAZAT is being built cleanly from the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository.

### Implemented source

- All Phase 0.1–0.7 monorepo, Identity, Booking, Dispatch, Journey, Safety, governed-completion and provider-disabled Finance foundations.
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
- Resumable DriverApplication lifecycle with guarded version transitions and immutable transition history.
- Deferred database agreement between application state, DriverProfile projection and authorised terminal decision.
- Self-service start/resume that recognises only existing verified-contact authority and exposes no approval path.
- Versioned region/service compliance requirements and evidence-kind separation.
- Driver document provenance, integrity hash, supersession/expiry lifecycle and immutable authorised review.
- Database-constrained rule that OCR/extraction is never authoritative verification.
- Versioned training with repeatable attempts, assessed pass evidence and explicit competency confirmation.
- High-risk service permission constrained to current assessed competency evidence.
- Scoped permission validity and narrow precautionary restriction truth.
- Derived operating eligibility with explicit blockers and separately evaluated availability.
- Permission/restriction hard filters integrated into go-online, candidate selection and offer acceptance, with candidate evidence IDs.
- Driver and Control Room onboarding/operating-authority truth surfaces.

### Verified in this checkpoint

- Earlier structural verifiers and source tests remain available through Phase 0.7.
- Phase 0.8 approval, evidence, competency, permission, restriction and availability-boundary verifier: **PASSED**.
- Pure-domain tests cover guarded application transitions, document authority, assessed/current competency, independent operating gates and scoped restrictions.
- Blueprint Phase 0.8 Driver onboarding and operating-permission traceability: **recorded**.

### Not yet verified / deliberately not claimed

- PostgreSQL/PostGIS migrations 0001–0008 and transaction/concurrency cases have not been executed in this workspace.
- Fastify, Expo and Vite workspaces have not been compiled with installed workspace dependencies here.
- Authorised school/hospital/specialist handover recording is not exposed until staff and operating-authority rules are implemented.
- Production payment provider selection, adapter/webhook/reconciliation execution, refunds and payouts are not implemented.
- Production identity/document verification provider selection, callbacks and reconciliation are not implemented.
- Jurisdiction-, region- and service-specific licensing, insurance, document, training and renewal policy is not approved or seeded.
- Authorised review roles, separation of duties, evidence upload/scanning, appeals, expiry/recomputation and offboarding workflows are not implemented.
- Chart of accounts, principal/agent status, tax/VAT, revenue recognition and Driver economics await accountable approval.
- PCI scope, fraud, dispute/chargeback, secrets, observability and payment incident controls require formal validation.
- Telemetry thresholds/radii and retention defaults await Operations, Safety, privacy, accessibility and safeguarding validation.
- No production Driver, vehicle, passenger, location, Safety, pricing, provider credentials or data are present.
- Source creation is not production readiness, safeguarding approval, licensing approval, insurance cover, payment certification or security certification.

## Founder/procurement gates

Selecting, contracting and enabling a production payment/payout provider remains a founder-level decision. The provider-neutral foundation can continue safely, but no charging, refund, settlement or payout path may be enabled before that decision and the required legal, accounting, security and operational controls.

Selecting or contracting an identity/document verification provider, and approving regional licensing/insurance policy, also remain accountable founder/compliance decisions. Phase 0.8 contains no provider call and no invented eligibility rule; those paths must remain disabled until the decisions and required privacy, safeguarding, security and operational controls exist.
