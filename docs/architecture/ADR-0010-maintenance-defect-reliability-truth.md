# ADR-0010: Maintenance, Defect and Vehicle Reliability Truth

Status: Accepted for Engineering Phase 0.10 source checkpoint
Date: 2026-08-30

## Context

Fleet eligibility and assignment do not prove that a vehicle remains safe or suitable to operate. Blueprint §54.3 requires vehicle-specific maintenance plans, concise Driver pre-shift observations, defect/recall/breakdown evidence, warranty-first repair control, independent return-to-service review, reliability analysis, replacement support and verified Driver benefits. Commercial pressure must never override a safety-critical restriction, while a breakdown or vague concern must never be converted into a Driver-neglect finding.

## Decision

1. Every operating vehicle fails closed without a current immutable maintenance-plan version and current requirements sourced from manufacturer, legal/licensing, DAZAT policy, Fleet agreement, defect, recall or breakdown follow-up truth.
2. Urgency is explicit: `ROUTINE`, `DUE_SOON`, `OVERDUE`, `SAFETY_REVIEW` or `DO_NOT_USE`. Due/overdue work requires action but is not silently treated as legal prohibition or Driver neglect. Safety-review and do-not-use states block operation.
3. A pre-shift check is a concise immutable Driver observation. `NOT_SURE` and free text allow “something does not feel right” without diagnosis. A concern creates a precautionary defect and restriction, moves an eligible vehicle to quarantine, takes a non-assigned Driver offline and opens passenger continuity separately when a Journey is active. It creates no Driver fault finding.
4. VehicleDefect, VehicleRestriction, MaintenanceCase and VehicleReplacementRequest have explicit guarded state/version histories. Many defects may link to one case and repeat-defect evidence preserves links to every contributing defect.
5. Vehicle restrictions may cover all services or named service codes. The same maintenance gate is consumed by Driver operating eligibility, Dispatch candidate/offer revalidation, Journey protected start, Fleet Marketplace visibility and vehicle-assignment validation.
6. Recall notice and recall resolution are separate immutable facts; an unresolved safety-critical recall independently blocks operation. Repair estimate is not final invoice. Repair authorisation requires a prior warranty evaluation. Maintenance completion and post-maintenance inspection are separate from an independently reviewed ReturnToServiceDecision.
7. Return to service fails closed while any current restriction, open safety-critical defect or required maintenance remains, or when completion, passed inspection, independent review or evidence is missing.
8. Breakdown and reliability observations remain separate from Driver maintenance-compliance assessments. Breakdown alone is database-constrained against proving neglect.
9. Vehicle replacement is separate from Journey passenger continuity and cannot penalise the act of reporting a defect.
10. Driver perks are immutable versions and may be published only with current provider verification, explicit benefit/eligibility/redemption terms and evidence. Whole-life vehicle evaluation requires acquisition, depreciation, insurance, service, repair, tyres, energy, downtime and resale evidence; brochure price alone is prohibited.
11. Phase 0.10 exposes authenticated Driver reads for maintenance and verified perks plus one idempotent pre-shift observation command. Provider booking, staff repair/return decisions, replacement assignment and commercial publication remain unavailable.

## Consequences

- A safety restriction cannot be bypassed by entering through Dispatch, Journey start, Marketplace or assignment validation.
- Drivers can report uncertainty early without being required to diagnose a vehicle or accepting an automatic fault finding.
- Warranty, estimate, authorisation, invoice, completion, inspection and return-to-service provenance remain auditable rather than collapsing into one mutable status.
- PostgreSQL execution, real provider/supplier integration, authorised staff workflows and jurisdictional/legal/operational approval remain required before production use.
