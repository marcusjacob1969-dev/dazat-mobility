# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.11 — Driver Performance, Fair Treatment, Conduct Protection, Appeal and Incentive Truth**

Status: **SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / PROVIDER, STAFF AND CHARGING MUTATIONS DISABLED / DATABASE, CONCURRENCY AND APP RUNTIME NOT YET VERIFIED**

DAZAT is being built cleanly from the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository.

### Implemented source

- All Phase 0.1–0.8 monorepo, Identity, Booking, Dispatch, Journey, Safety, governed-completion, provider-disabled Finance and Driver operating-permission foundations.
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
- Explicit vehicle access routes, Fleet tiers and guarded FleetVehicle state/history.
- Verified FleetOrganisation tenancy without compliance/permission bypass authority.
- Immutable versioned Marketplace offers with supplier stock/warranty provenance and complete commercial terms.
- Explicit evidence-backed vehicle capability snapshots; no body-style inference.
- Actual Driver–vehicle pair insurance validation integrated into operating eligibility and Dispatch.
- Versioned FleetAgreement and VehicleFinanceAgreement persistence/current projections.
- Deposit obligation separated from platform revenue and condition/basis/dispute guard for proposed deductions.
- Immutable condition/equipment VehicleHandoverRecord.
- Fresh full assignment/replacement validation and deferred active-assignment guard.
- Read-only Marketplace, agreement and assignment-validation APIs plus Driver/Control Room truth surfaces.
- Immutable versioned maintenance plans and multi-source current requirements with explicit urgency.
- Concise immutable pre-shift observation supporting uncertainty without Driver diagnosis or automatic fault finding.
- Transactional concern handling across defect/restriction history, precautionary quarantine, safe offline transition, Journey continuity and outbox evidence.
- Guarded defect, vehicle restriction, maintenance case and replacement-request lifecycle histories.
- Separate recall/resolution, warranty evaluation, estimate, authorisation, invoice, completion, inspection and independent return-to-service truth.
- Provider-quality and repeat-defect evidence plus separate reliability and Driver maintenance-compliance records.
- Verified versioned Driver perks and complete whole-life cost evidence that prohibits brochure-price-only evaluation.
- One authoritative maintenance gate integrated into Marketplace, assignment validation, Driver eligibility, Dispatch and Journey protected start.
- Authenticated maintenance/perks reads and idempotent Driver pre-shift command plus Driver/Control Room truth surfaces.
- Separate rating, Safety, compliance, reliability, feedback, cancellation, training and security dimensions with no opaque Driver Score.
- Immutable rating feedback that cannot itself create a finding, restriction or Dispatch-priority change.
- Guarded complaint lifecycle with separate allegation, evidence, Driver response, assessment, finding and action records.
- Exact Driver-offer outcome attribution integrated into decline, timeout, acceptance, ineligibility and assigned-elsewhere paths without ordinary-decline punishment.
- Evidence-backed reliability review that distinguishes Driver, vehicle, system, provider, traffic and external causes.
- Narrow, reviewable precautionary Driver restrictions that are database-constrained against becoming guilt findings.
- Governed high-impact Driver appeal aggregate with immutable evidence, independent resolution and preserved original history.
- Safety-owned RiderConductCase and assigned-Driver protected reporting for violence, harassment, discrimination, fraud and dangerous behaviour.
- Atomic unsafe-Journey termination across canonical Safety truth, interrupted leg, cancelled assignment, passenger continuity, Booking incident state and Driver break, with rating protection and no Driver fault finding.
- Versioned, evidence-backed and Finance-approved incentive truth separated from base earnings, acceptance coercion, fatigue pressure and hidden Dispatch priority.
- Offboarding records that preserve earnings, disputes, vehicle-return obligations and historical Safety/Finance truth.
- Authenticated fair-treatment, conduct, unsafe-termination, appeal and incentive APIs plus Driver/Control Room truth surfaces.

### Verified in this checkpoint

- All structural verifiers pass from the foundation through Phase 0.11.
- All 56 executable Phase 0.5–0.11 source-domain tests pass.
- Phase 0.9 supplier, terms, capability, insurance, deposit and assignment-boundary verifier: **PASSED**.
- Pure-domain tests cover Fleet state, Marketplace publication, ownership-transfer terms, explicit capability, deposit deduction and assignment hard checks.
- Blueprint §54.2 Fleet Marketplace/agreement/assignment traceability: **recorded**.
- Phase 0.10 maintenance/defect/reliability boundary verifier: **PASSED**.
- Pure-domain tests cover pre-shift uncertainty, maintenance urgency/restrictions, defect history, warranty-first repair, reviewed return to service, verified perks and whole-life evidence.
- Blueprint §54.3 and §66.21 maintenance/reliability traceability: **recorded**.
- Phase 0.11 Driver fair-treatment boundary verifier: **PASSED**.
- Pure-domain tests cover ratings, complaint stages, exact offer outcomes, reliability attribution, restrictions, appeals, unsafe termination, incentives and offboarding preservation.
- Blueprint §54.4, §66.22 and fair-treatment P1 traceability: **recorded**.

### Not yet verified / deliberately not claimed

- PostgreSQL/PostGIS migrations 0001–0011 and transaction/concurrency cases have not been executed in this workspace.
- Fastify, Expo and Vite workspaces have not been compiled with installed workspace dependencies here.
- Authorised school/hospital/specialist handover recording is not exposed until staff and operating-authority rules are implemented.
- Production payment provider selection, adapter/webhook/reconciliation execution, refunds and payouts are not implemented.
- Production identity/document verification provider selection, callbacks and reconciliation are not implemented.
- Jurisdiction-, region- and service-specific licensing, insurance, document, training and renewal policy is not approved or seeded.
- Authorised review roles, separation of duties, evidence upload/scanning, adjudication mutations, appeal-resolution queues and offboarding execution are not implemented. Driver appeal submission and persistence are implemented.
- No Fleet supplier, stock/warranty feed, rental/lease/finance product or agreement terms are selected, contracted, seeded or contacted.
- Marketplace publication/reservation, agreement acceptance/activation, handover acknowledgement, deposit funding/deduction and vehicle assignment workflows are not implemented.
- No maintenance/recovery/parts/warranty/inspection/telematics/perk provider, policy or operational threshold is selected, contracted, seeded or contacted.
- Staff defect triage, provider booking, estimate/repair approval, invoice reconciliation, independent return-to-service and replacement fulfilment workflows are not implemented.
- Rental/lease/credit, deposit safeguarding, consumer/commercial terms, tax/VAT and supplier obligations require accountable approval.
- Chart of accounts, principal/agent status, tax/VAT, revenue recognition and Driver economics await accountable approval.
- PCI scope, fraud, dispute/chargeback, secrets, observability and payment incident controls require formal validation.
- Telemetry thresholds/radii and retention defaults await Operations, Safety, privacy, accessibility and safeguarding validation.
- No production Driver, vehicle, passenger, location, Safety, pricing, provider credentials or data are present.
- Source creation is not production readiness, safeguarding approval, licensing approval, insurance cover, payment certification or security certification.

## Founder/procurement gates

Selecting, contracting and enabling a production payment/payout provider remains a founder-level decision. The provider-neutral foundation can continue safely, but no charging, refund, settlement or payout path may be enabled before that decision and the required legal, accounting, security and operational controls.

Selecting or contracting an identity/document verification provider, and approving regional licensing/insurance policy, also remain accountable founder/compliance decisions. Phase 0.8 contains no provider call and no invented eligibility rule; those paths must remain disabled until the decisions and required privacy, safeguarding, security and operational controls exist.

Selecting Fleet suppliers and approving any rental, lease, finance, deposit or ownership-transfer terms is also a founder/procurement/legal/Finance gate. Phase 0.9 stores no real offer and exposes no mutation that can reserve, contract, charge, deduct or assign a vehicle.

Selecting maintenance, recovery, parts, warranty, inspection, telematics or Driver-perk providers and approving service/recall/return-to-service policy is a founder/procurement/legal/Operations/Safety gate. Phase 0.10 stores no real provider offer and exposes no staff mutation that can book repair, approve spend, return a vehicle to service, assign a replacement or market an unverified benefit.

Approving real Driver performance policy, complaint evidence access, restriction/offboarding authority, appeal reviewer roles and incentive terms remains a founder/legal/People/Operations/Safety/Finance gate. Phase 0.11 exposes Driver reporting and appeal submission but no staff adjudication editor, real incentive publication or destructive Driver-history deletion path.
