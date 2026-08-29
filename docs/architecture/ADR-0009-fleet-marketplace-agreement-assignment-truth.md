# ADR-0009: Fleet Marketplace, Agreement and Vehicle Assignment Truth

Status: Accepted for Engineering Phase 0.9 source checkpoint
Date: 2026-08-29

## Context

Driver operating permission does not establish how a Driver accesses a vehicle, what a Fleet supplier actually offers, whether an agreement is current, or whether insurance covers the exact Driver–vehicle pair. Blueprint §54.2 requires first-class owned/rental/lease routes, transparent total terms, versioned agreements, evidence-backed handover, explicit capabilities and full revalidation for replacement assignments. Supplier inventory, warranty, finance and commercial terms have not been selected or verified for production.

## Decision

1. Vehicle access routes are explicit: Driver-owned, weekly rent, rent-to-own, fixed-term lease and lease-to-own. Fleet tiers are separate from access route.
2. FleetVehicle state is versioned and guarded across available, reserved, assigned, in-service, maintenance, repair, quarantined, awaiting-inspection, return-pending and retired states. Retired is terminal.
3. Marketplace offers are immutable versions. Publication requires current supplier stock/warranty evidence, total contract cost, periodic charge, deposit, term, mileage terms, included/excluded services and end-of-term conditions. Ownership-transfer terms are mandatory for rent/lease-to-own.
4. No generic discount percentage is stored or projected. The current marketplace view returns only the latest published version for an available, currently eligible vehicle with current explicit capabilities and, where applicable, an active verified FleetOrganisation.
5. Vehicle capability is an append-only, evidence-backed snapshot. Passenger/luggage capacity and WAV, school, executive and airport capability are explicit; body style never infers them.
6. FleetAgreement and VehicleFinanceAgreement use immutable versions. A changed status or term creates a new version rather than rewriting history.
7. Deposit obligation is separate from platform revenue and must link to Finance ledger truth once funded. Obligation and deduction lifecycles require append-only transition history. A proposed deduction requires condition evidence, agreement basis, a dispute route, and approved/settled deductions cannot cumulatively exceed the recorded deposit.
8. VehicleHandoverRecord is immutable evidence for mileage, fuel/charge, existing damage, equipment, keys and camera/accessibility equipment. It does not itself authorise a deduction.
9. Insurance validation belongs to the exact Driver–vehicle pair. The current authorisation projection requires both active DriverVehicleAuthorisation and current eligible pair insurance.
10. Vehicle assignment requires current Driver operating eligibility, pair authorisation/insurance, vehicle eligibility, explicit current capability, active agreement, acceptable FleetVehicle state and fresh assignment validation. Assignment identity is immutable and lifecycle changes require versioned append-only history. A replacement links the old assignment and re-runs the same checks.
11. External FleetOrganisation tenancy is supported as ownership/operating context but must be current and active, and can never bypass DAZAT identity, training, compliance, insurance, permission, Safety or assignment rules.
12. Phase 0.9 exposes only authenticated Driver reads: current Marketplace offers, current agreement versions and a read-only assignment validation. No supplier, agreement, deposit, handover, Fleet state or assignment mutation route is exposed.

## Consequences

- DAZAT can preserve supplier and agreement provenance without making an unverified commercial promise.
- Dispatch now treats actual-pair insurance as part of Driver–vehicle authorisation.
- Deposit and proposed-deduction truth cannot be collapsed into revenue or silently applied.
- The source still needs PostgreSQL execution, supplier/procurement approval, agreement/legal review, Finance integration and authorised operational workflows before a real vehicle can be offered or assigned.
