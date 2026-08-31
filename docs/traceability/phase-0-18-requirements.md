# Phase 0.18 Organisation Operations Part 2 traceability

| Blueprint §63 requirement / invariant | Source implementation | Status |
|---|---|---|
| Institutional objects prepare canonical Booking | occurrence evaluator and hard-false template boundaries | SOURCE_TESTED |
| Passenger identity is organisation-independent | managed relationship evaluator and database constraints | SOURCE_TESTED |
| Same passenger can have isolated tenant relationships | disclosure blocker and tenant IDs | SOURCE_TESTED |
| Managed profile is minimum transport data | diagnosis/global-reference/ownership hard constraints | SOURCE_TESTED |
| Roster is a relationship, not person copy | membership aggregate and status evidence | SOURCE_TESTED |
| Removal preserves identity and other relationships | membership-end evaluator | SOURCE_TESTED |
| Booking and funding authority stay separate | institutional authority evaluator | SOURCE_TESTED |
| Funding authorisation is not stored money | versioned funding table hard constraint | SOURCE_TESTED |
| Missing funding cannot become personal liability | explicit exception action and hard constraint | SOURCE_TESTED |
| Service eligibility uses structured requirements | eligibility version and evaluator | SOURCE_TESTED |
| Eligibility rechecks at Booking/Dispatch/reassignment | explicit evaluator stage | SOURCE_TESTED |
| Accessibility cannot be downgraded | eligibility exception and database guard | SOURCE_TESTED |
| Diagnosis is not default hospital/care data | domain blocker and SQL false fields | SOURCE_TESTED |
| Authorised contacts have scoped access | versioned contact permissions | SOURCE_TESTED |
| Communication plan uses governed Communications | profile reference and ADR boundary | SOURCE_TESTED |
| Template is not Booking/Driver reservation/liability | hard-false domain/API/database fields | SOURCE_TESTED |
| Series creates independent canonical occurrences | occurrence evaluator and unique Booking FK | SOURCE_TESTED |
| Recurrence and calendars are structured | generation guard and calendar versions/dates | SOURCE_TESTED |
| Generation horizon is configurable and bounded | series horizon and evaluator | SOURCE_TESTED |
| Generated Booking retains version context | occurrence and booking provenance records | SOURCE_TESTED |
| Change scope is explicit | amendment enum/table/evaluator | SOURCE_TESTED |
| Completed and active transport is protected | amendment hard constraints | SOURCE_TESTED |
| School closures are structured | SchoolCalendar date types | SOURCE_TESTED |
| Familiarity cannot override eligibility | school evaluator | SOURCE_TESTED |
| Handover persists per occurrence | school requirement gate | SOURCE_TESTED |
| Scheduled flow uses capability-aware capacity | reservation constraint and evaluator | SOURCE_TESTED |
| Driver schedule checks are complete | assessment evidence and evaluator | SOURCE_TESTED |
| Flexible pickup windows are truthful | ordered window and no-guarantee constraint | SOURCE_TESTED |
| Hospital/care readiness is not diagnosis | readiness event and minimisation constraints | SOURCE_TESTED |
| Authority funding decision is received, not invented | statutory-decision hard constraint | SOURCE_TESTED |
| Visitor relationships can be time-limited | membership validity model | SOURCE_TESTED |
| Passenger bulk import is dry-run and row-level | batch/row tables and guards | SOURCE_TESTED |
| Duplicate handling leaks no other tenant | false disclosure fields and blocker | SOURCE_TESTED |
| Bulk Booking validates every authority dimension | booking row validation fields | SOURCE_TESTED |
| Bulk commit is idempotent and deterministic | unique idempotency and status evidence | SOURCE_TESTED |
| Passenger substitution revalidates all scope | substitution evaluator/decision | SOURCE_TESTED |
| Active Journey passenger relabel is rejected | hard constraint and evaluator | SOURCE_TESTED |
| Cancellation is reason-coded canonical transition | cancellation decision | SOURCE_TESTED |
| No-show is service-specific; NOT_READY distinct | readiness/cancellation evaluators | SOURCE_TESTED |
| Breakdown keeps original Booking/Journey | acceptance invariant and provenance | SOURCE_TESTED |
| Exception queue has owner/priority/action/outcome | guarded exception model | SOURCE_TESTED |
| Routine exceptions do not replace Safety/School | hard-false exception boundary | SOURCE_TESTED |
| Institutional reporting is minimised | report evaluator | SOURCE_TESTED |
| Every Booking retains authority/version provenance | institutional booking provenance | SOURCE_TESTED |
| Ten API domains catalogued, no direct Journey/Payment write | API constant and hard-false boundary | SOURCE_TESTED |
| Fifteen commands remain conceptual | command catalogue; mutations disabled | NOT_IMPLEMENTED |
| Eighteen versioned events are explicit | event constant and append-only table | SOURCE_TESTED |
| Nineteen P0 requirements are explicit | P0 catalogue and capability projection | SOURCE_TESTED |
| Acceptance cases 35–52 are explicit | scenario catalogue/version table and 32 tests | SOURCE_TESTED |
