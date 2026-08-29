# Phase 0.9 Blueprint Traceability

Truth labels follow Master Blueprint §83: `SOURCE_CREATED`, `SOURCE_TESTED`, `PARTIAL_SOURCE`, or `NOT_IMPLEMENTED`. No row claims production verification.

| Blueprint §54.2 requirement / acceptance | Phase 0.9 evidence | Truth |
|---|---|---|
| First-class vehicle access routes | aligned domain/database/OpenAPI enums | SOURCE_TESTED |
| Explicit Fleet tiers | separate tier enum and Marketplace projection | SOURCE_TESTED |
| Supplier stock/warranty terms authoritative; no generic discount | published-offer database guard, current version view and constant-false projection | SOURCE_TESTED |
| Marketplace shows total cost, included/excluded services, deposit, term, mileage and end conditions | immutable offer schema/contracts/API | SOURCE_CREATED |
| Ownership transfer terms where applicable | domain and database guards for rent/lease-to-own | SOURCE_TESTED |
| FleetAgreement and VehicleFinanceAgreement are versioned | root/version records with immutable version rows/current projection | SOURCE_CREATED |
| Deposit is separate from revenue | constant-false revenue flag, Finance ledger foreign key and guarded append-only obligation lifecycle | SOURCE_TESTED |
| Deposit deduction needs evidence, agreement basis and dispute route | schema, cumulative approved/settled amount guard, append-only history and pure-domain guard | SOURCE_TESTED |
| Handover captures mileage, energy, damage, equipment, keys, camera/accessibility equipment | immutable VehicleHandoverRecord | SOURCE_CREATED |
| Vehicle capability is explicit, not inferred from body style | append-only capability snapshot, current view and constant-false domain rule | SOURCE_TESTED |
| Insurance validates actual Driver–vehicle pair | pair-keyed append-only validation and current authorisation view | SOURCE_CREATED |
| Replacement assignment re-runs all hard checks | fresh validation snapshot, current capability/Fleet state/external-organisation gates, replacement link and deferred assignment guard | SOURCE_TESTED |
| Fleet states are explicit and guarded | state/version transition machine and history constraint | SOURCE_TESTED |
| External FleetOrganisation tenancy cannot bypass DAZAT rules | non-overlapping verified tenancy, active-organisation requirement, false bypass constraint/projection and assignment hard checks | SOURCE_TESTED |
| Marketplace publication/reservation/agreement/assignment workflows | read-only projections only; authorised mutations deliberately absent | NOT_IMPLEMENTED |
| Real suppliers, stock, warranties and commercial/finance terms | no provider selected, seeded or contacted | NOT_IMPLEMENTED |

## Evidence commands

```sh
npm run verify:phase-0-9
npm run test:phase-0-9-domain
git diff --check
```

PostgreSQL execution, concurrency, full dependency compilation, supplier integration, agreement/Finance operations, legal review and app E2E remain unverified and are listed in the Phase 0.9 checklist.
