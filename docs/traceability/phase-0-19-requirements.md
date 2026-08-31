# Phase 0.19 Organisation Operations Part 3 traceability

| Blueprint §64 requirement / invariant | Source implementation | Status |
|---|---|---|
| Agreement terms are versioned/effective-dated | agreement evaluator, aggregate/status evidence and version references | SOURCE_TESTED |
| Contract and operational Organisation status differ | domain blocker and database false field | SOURCE_TESTED |
| Agreement, service policy and pricing stay separate | evaluator plus independent version tables | SOURCE_TESTED |
| Future work is classified before expiry | agreement gate and future Booking classification | SOURCE_TESTED |
| Hard protections outrank commercial preference | policy-precedence evaluator | SOURCE_TESTED |
| Policy conflict opens controlled review | explicit review action | SOURCE_TESTED |
| Approval, Booking and funding authority differ | approval evaluator | SOURCE_TESTED |
| Approval never assigns a Driver | hard-false return and database/API boundaries | SOURCE_TESTED |
| Urgent active-passenger continuity outranks PO approval | urgent exception evaluator/table | SOURCE_TESTED |
| Billing hierarchy does not own ledger | billing evaluator and false ledger fields | SOURCE_TESTED |
| Missing funding never creates passenger liability | funding exception action and SQL constraints | SOURCE_TESTED |
| Structured references cannot rewrite closed invoices | immutable PO/funding records | SOURCE_TESTED |
| Credit restriction is prospective | credit evaluator/current status and event evidence | SOURCE_TESTED |
| Active journey and Safety continue under arrears | credit hard constraints | SOURCE_TESTED |
| Portal scope is backend-authorised | portal evaluator and exact membership SQL | SOURCE_TESTED |
| Finance and safeguarding permission stay separate | portal denial evaluator and read minimisation | SOURCE_TESTED |
| SLA metrics are versioned and reproducible | policy/measurement tables and evaluator | SOURCE_TESTED |
| Causation stays distinct | causation assessment | SOURCE_TESTED |
| Stale GPS and Safety suppression are prohibited | evaluator and SQL false fields | SOURCE_TESTED |
| Allegation is not automatic guilt | allegation evaluator and case constraints | SOURCE_TESTED |
| Corrective action is owned and evidenced | corrective-action aggregate | SOURCE_TESTED |
| Contract change is prospective and simulated | change/simulation/impact aggregates | SOURCE_TESTED |
| Completed and active transport is protected | simulation evaluator and SQL constraints | SOURCE_TESTED |
| API secret rotation and tenant scopes fail closed | integration evaluator and existing credential model | SOURCE_TESTED |
| API writes are idempotent | integration evaluator and command deduplication | SOURCE_TESTED |
| Webhooks are signed/deduplicable/minimised | integration evaluator and existing webhook model | SOURCE_TESTED |
| Exports are role/purpose scoped | export evaluator/reporting policy | SOURCE_TESTED |
| High-risk exports require step-up/approval | export evaluator/reporting policy | SOURCE_TESTED |
| Suspension/termination preserve active/history truth | exit evaluator and future classification | SOURCE_TESTED |
| Reinstatement revalidates rather than restores blindly | reinstatement assessment | SOURCE_TESTED |
| Canonical cancellation/no-show classification survives remedy | remedy evaluator/service-credit instruction | SOURCE_TESTED |
| Migration is dry-run, row-level and minimised | batch/row tables and evaluator | SOURCE_TESTED |
| Legacy flags cannot bypass current eligibility | migration hard constraints | SOURCE_TESTED |
| Twelve API domains are catalogued | API constant and capability projection | SOURCE_TESTED |
| Ten commands remain conceptual | command catalogue; mutations disabled | NOT_IMPLEMENTED |
| Sixteen versioned events are explicit | event constant and append-only event/outbox | SOURCE_TESTED |
| Twenty P0 requirements are explicit | P0 catalogue and capability projection | SOURCE_TESTED |
| Acceptance cases 53–71 are explicit | scenario catalogue/version table and 32 tests | SOURCE_TESTED |
