# Phase 0.20 Organisation Operations Part 4 traceability

| Blueprint §64.31–§64.74 requirement / invariant | Source implementation | Status |
|---|---|---|
| Control Room is a scoped canonical lens | workspace-access evaluator, task-scope table and read-only routes | SOURCE_TESTED |
| Critical attention is owned and timed | attention aggregate/guard and evaluator | SOURCE_TESTED |
| Exceptions remain structured and specialist cases stay independent | exception aggregate, canonical links and evaluator | SOURCE_TESTED |
| Resolution differs from verification | status evidence plus verification record | SOURCE_TESTED |
| Readiness dimensions remain separate | assessment/dimension records and evaluator | SOURCE_TESTED |
| READY never guarantees a Driver | hard-false return and test | SOURCE_TESTED |
| Manual Dispatch uses every hard filter | dispatch assessment and evaluator | SOURCE_TESTED |
| NO_ELIGIBLE_DRIVER remains explicit | manual Dispatch action and outcome catalogue | SOURCE_TESTED |
| Booking retains historical execution context | immutable execution-context record and evaluator | SOURCE_TESTED |
| Failed school handover blocks completion and opens P1 | handover evaluator/record | SOURCE_TESTED |
| Authority funding does not invent eligibility or passenger liability | funding evaluator and SQL constraints | SOURCE_TESTED |
| Hospital readiness is distinct from no-show and payment authority | ready-state/context records and evaluator | SOURCE_TESTED |
| Corporate and guest access remains minimal and scoped | visibility/profile evaluators and records | SOURCE_TESTED |
| Live change is canonical and reauthorised | live-change assessment and evaluator | SOURCE_TESTED |
| Canonical outcomes cannot be rewritten for Finance or SLA | outcome assessment and evaluator | SOURCE_TESTED |
| Breakdown preserves one Booking/Journey with parallel continuity/rescue | continuity context and evaluator | SOURCE_TESTED |
| Organisation cannot suppress or close Safety | Safety link and evaluator | SOURCE_TESTED |
| Compliance evidence is scoped and minimised | evidence package/items and evaluator | SOURCE_TESTED |
| Critical data quality blocks work; operators do not guess | issue aggregate/guard and evaluator | SOURCE_TESTED |
| Site disruptions are structured and series-safe | site profile/disruption/impact records and evaluator | SOURCE_TESTED |
| Partner overflow applies equivalent controls | partner assessment and evaluator | SOURCE_TESTED |
| Degraded mode has canonical contingency and reconciliation | degraded-mode decision and evaluator | SOURCE_TESTED |
| Security containment preserves safe active journeys | containment decision and evaluator | SOURCE_TESTED |
| Tracking expires and AI cannot invent authority | tracking grant, AI record and evaluator | SOURCE_TESTED |
| Service health is evidence-backed and non-cancelling | health assessment and evaluator | SOURCE_TESTED |
| Shift handover transfers structured critical ownership | handover/item records and evaluator | SOURCE_TESTED |
| Signed agreement alone cannot launch | launch readiness/gate records and evaluator | SOURCE_TESTED |
| Failed pilot gate blocks expansion | pilot/gate records and evaluator | SOURCE_TESTED |
| Exit preserves active passengers, lawful history and open cases | exit plan/inventory and evaluator | SOURCE_TESTED |
| Final P0 collision resolution is authoritative | reconciled 21-ID catalogue and OpenAPI projection | SOURCE_TESTED |
| Eleven API domains are catalogued | API catalogue and capability projection | SOURCE_TESTED |
| Twelve commands remain conceptual | command catalogue; mutations disabled | NOT_IMPLEMENTED |
| Seventeen versioned events are explicit | event catalogue and append-only event/outbox | SOURCE_TESTED |
| Acceptance cases 72–101 are explicit | 30-scenario catalogue/version table and 38 tests | SOURCE_TESTED |
