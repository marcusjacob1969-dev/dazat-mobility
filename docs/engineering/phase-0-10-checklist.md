# Engineering Phase 0.10 Checklist

Checkpoint: Maintenance, Defect, Recall, Reliability, Replacement and Verified Perks Truth
Status: SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / EXTERNAL AND STAFF OPERATIONS DISABLED / DATABASE AND APP RUNTIME UNVERIFIED

## Source implementation

- [x] Immutable versioned VehicleMaintenancePlan and current projection.
- [x] Manufacturer, legal/licensing, DAZAT-policy, Fleet-agreement, defect, recall and breakdown-follow-up requirement sources.
- [x] Explicit routine, due-soon, overdue, safety-review and do-not-use urgency.
- [x] Immutable concise pre-shift check with `NOT_SURE` and free-text uncertainty; diagnosis not required.
- [x] Concern transaction persists defect/restriction history, precautionary quarantine, safe offline transition and separate active-Journey continuity case.
- [x] Guarded VehicleDefect, VehicleRestriction, MaintenanceCase and VehicleReplacementRequest lifecycle history.
- [x] Many-to-many defect/case and repeat-defect evidence links.
- [x] Separate recall notice/resolution, unresolved safety-critical recall hard gate and provider-quality evidence.
- [x] Warranty-first repair-authorisation constraint; estimate, invoice, completion and inspection remain distinct.
- [x] Deferred reviewed ReturnToServiceDecision hard gate.
- [x] Breakdown/reliability evidence separate from Driver maintenance-compliance findings.
- [x] Replacement request separate from passenger continuity and constrained against report penalty.
- [x] Verified versioned Driver perks across fuel, charging, tyres, servicing, insurance, inspection and training.
- [x] Complete whole-life cost evidence; brochure-price-only evaluation prohibited.
- [x] Maintenance gate integrated into Marketplace, assignment validation, Driver eligibility, Dispatch and Journey start.
- [x] Authenticated maintenance/perks reads and idempotent Driver pre-shift command.
- [x] Driver and Control Room maintenance truth surfaces.
- [x] OpenAPI 0.0.10 documents the safe surface and constant-false fault/neglect claims.

## Verification completed here

- [x] Phase 0.10 structural/security verifier passes.
- [x] Ten pure-domain tests cover mandatory checks, uncertainty, urgency, service restrictions, warranty, return-to-service, perks, whole-life evidence and truth separation.
- [x] Node TypeScript syntax checks pass for all non-JSX Phase 0.10 modules.
- [x] OpenAPI YAML and every package JSON parse; repository whitespace/error checks pass.
- [x] Existing Phase 0.1–0.9 structural and source-domain checks remain passing.

## Not yet executed or claimed

- [ ] Run migrations 0001–0010 against PostgreSQL 16 + PostGIS and exercise deferred/history/concurrency constraints.
- [ ] Compile Fastify, Expo and Vite workspaces after installing declared dependencies.
- [ ] Approve jurisdiction-specific inspection, service, licensing, recall, retention and return-to-service policy.
- [ ] Select/contract maintenance, recovery, parts, warranty, inspection, telematics, Fleet and perk providers.
- [ ] Implement authorised staff triage, estimate review, repair approval, provider booking, invoice reconciliation and independent return-to-service operations.
- [ ] Implement replacement fulfilment and passenger-continuity operations without penalising defect reporting.
- [ ] Implement provider callbacks/reconciliation, evidence upload/scanning, roles, separation of duties, appeals and audit access.
- [ ] Conduct accessibility, privacy, security, licensing, insurance, consumer/commercial, safeguarding and operational review.

This checkpoint is source evidence, not production readiness, a diagnosis, a finding of Driver fault, provider approval, a repair authorisation, a return-to-service decision or permission to market an unverified benefit.
