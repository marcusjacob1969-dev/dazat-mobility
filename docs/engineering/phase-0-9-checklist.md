# Engineering Phase 0.9 Checklist

Checkpoint: Fleet Marketplace, Vehicle Tiers, Rental, Lease and Assignment Truth
Status: SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / SUPPLIER AND AGREEMENT MUTATIONS DISABLED / DATABASE AND APP RUNTIME UNVERIFIED

## Source implementation

- [x] First-class Driver-owned, weekly-rent, rent-to-own, fixed-term-lease and lease-to-own access routes.
- [x] Explicit Fleet tiers without generic supplier discount assumptions.
- [x] Guarded FleetVehicle state/version transitions with append-only history.
- [x] Verified external FleetOrganisation tenancy that cannot grant compliance authority.
- [x] Immutable versioned Marketplace offers with supplier stock/warranty provenance.
- [x] Total cost, periodic charge, deposit, term, mileage, end conditions and included/excluded services projected explicitly.
- [x] Ownership-transfer terms required for rent/lease-to-own.
- [x] Explicit evidence-backed vehicle capability snapshot; no body-style inference.
- [x] Actual Driver–vehicle pair insurance validation integrated into current authorisation and Dispatch.
- [x] Versioned FleetAgreement and VehicleFinanceAgreement truth.
- [x] Deposit obligation separated from platform revenue and funded Finance truth, with guarded append-only lifecycle history.
- [x] Proposed deduction evidence, agreement basis, dispute route, cumulative amount guard and append-only lifecycle history.
- [x] Immutable VehicleHandoverRecord for condition/equipment truth.
- [x] Fresh assignment validation, explicit-capability/current-state checks and active external-tenancy authority.
- [x] Replacement assignment must link and revalidate the replaced assignment.
- [x] VehicleAssignment identity, lifecycle fields, version transitions and history are guarded.
- [x] Read-only Marketplace, Driver agreement and assignment-validation APIs.
- [x] Driver and Control Room Fleet truth surfaces.
- [x] OpenAPI 0.0.9 documents the safe read-only surface.

## Verification completed here

- [x] Phase 0.9 structural/security verifier passes.
- [x] Pure-domain tests cover Fleet state, Marketplace publication, capability, deposit deduction, external tenancy and assignment gates.
- [x] Node TypeScript syntax checks pass for non-JSX modules.
- [x] OpenAPI YAML parses, JSON parses and repository whitespace/error checks pass.
- [x] Existing Phase 0.1–0.8 structural and source tests remain passing.

## Not yet executed or claimed

- [ ] Run migrations 0001–0009 against PostgreSQL 16 + PostGIS and exercise deferred Fleet/assignment constraints.
- [ ] Compile Fastify, Expo and Vite workspaces after installing declared dependencies.
- [ ] Approve supplier(s), actual stock feeds, warranties, service inclusions, SLAs and exit/portability terms.
- [ ] Approve rental/lease/finance agreements, consumer/commercial credit treatment, tax/VAT and deposit safeguarding.
- [ ] Implement authorised Marketplace publication, reservation, agreement acceptance/activation, payment and assignment workflows.
- [ ] Implement deposit funding/return/deduction dispute workflow through Finance ledger authority.
- [ ] Implement handover acknowledgement/dispute, evidence upload/scanning, staff separation of duties and appeals.
- [ ] Implement external FleetOrganisation role/tenant administration without broad database authority.
- [ ] Conduct accessibility, privacy, security, licensing, insurance, financial-services, legal and operational review.

This checkpoint is source evidence, not production readiness, a vehicle offer, an approved lease/credit product, permission to hold/deduct a deposit, supplier approval or permission to assign a vehicle.
