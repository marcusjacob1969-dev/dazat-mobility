# Phase 0.8 Blueprint Traceability

Truth labels follow Master Blueprint §83: `SOURCE_CREATED`, `SOURCE_TESTED`, `PARTIAL_SOURCE`, or `NOT_IMPLEMENTED`. No row claims production verification.

| Blueprint requirement / acceptance | Phase 0.8 evidence | Truth |
|---|---|---|
| Driver application is resumable with explicit lifecycle states | versioned aggregate, transition guard/history and current projection | SOURCE_TESTED |
| Driver cannot self-approve | only start/resume mutation exposed; `REVIEW_PENDING → APPROVED` additionally requires immutable authorised decision | SOURCE_TESTED |
| Identity, driving entitlement, licensing, training, vehicle, insurance and service permission remain separate | versioned requirement/evidence kinds, documents, training, vehicle eligibility and service-permission records | SOURCE_CREATED |
| OCR provenance is not verification authority | extraction flag database-constrained false; domain constant false; authorised review required for `VERIFIED` | SOURCE_TESTED |
| Superseded and expired document evidence is preserved | document lifecycle includes `EXPIRED`/`SUPERSEDED`, content hash and supersession link; no delete workflow | SOURCE_CREATED |
| Training is versioned and attendance is not competency | module version/assessment policy plus repeatable attempts and pure-domain competency guard | SOURCE_TESTED |
| High-risk permission requires current assessed competency | module assessment database checks and deferred permission/evidence/validity guard | SOURCE_TESTED |
| Permission is scoped by region and service | explicit service code, region, risk tier, source and validity window | SOURCE_CREATED |
| Restrictions narrow rather than invent broad bans | enumerated scopes; school/WAV filtering, selected-vehicle blocker and payout separation tests | SOURCE_TESTED |
| Precautionary restriction is not a guilt finding | explicit `precautionary` field and Control Room truth label | SOURCE_CREATED |
| Operating eligibility derives from account, application, compliance, selected vehicle, permissions and restrictions | pure decision function and authenticated projection query with explicit blockers | SOURCE_TESTED |
| Operating eligibility distinguishes eligible, partial and not eligible | domain/contracts/database/OpenAPI aligned to the three statuses | SOURCE_TESTED |
| Availability remains distinct from operating permission | projection marks separate evaluation; no availability mutation in Phase 0.8 routes | SOURCE_TESTED |
| Dispatch must not bypass scoped permission truth | go-online, candidate and offer-acceptance hard filters; candidate permission/restriction evidence IDs | SOURCE_CREATED |
| Account status remains distinct from Driver approval | dedicated capability and account-active eligibility input; profile projection remains separate | SOURCE_TESTED |
| Region/service licensing and insurance policy | versioned requirement structure only; no unapproved rules seeded | PARTIAL_SOURCE |
| External identity/document verification | no provider selected or called; provider authority is only a future generic boundary | NOT_IMPLEMENTED |
| Authorised staff review, appeals, offboarding and historical case workflow | database evidence boundary only; mutation/API/operations workflow deliberately absent | NOT_IMPLEMENTED |

## Evidence commands

```sh
npm run verify:phase-0-8
npm run test:phase-0-8-domain
git diff --check
```

PostgreSQL execution, concurrency, full dependency compilation, external verification, staff operations, policy approval and app E2E remain unverified and are listed in the Phase 0.8 checklist.
