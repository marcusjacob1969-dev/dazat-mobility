# Phase 0.11 Driver fair-treatment traceability

| Requirement | Source implementation | Status |
|---|---|---|
| No opaque Driver Score; performance dimensions remain separate | `driver-fair-treatment.ts`; `current_driver_fair_treatment_projection`; Driver/Control Room labels | SOURCE_TESTED |
| Rating is feedback, not finding/restriction/priority | `driver_rating_feedback` hard-false constraints; `evaluateRatingFeedback` | SOURCE_TESTED |
| Complaint allegation, evidence, response, assessment, finding and action remain distinct | six persistence records plus guarded stage/history functions | SOURCE_TESTED |
| Ordinary decline is not misconduct and does not reduce Dispatch priority | exact `driver_offer_outcome_attribution`; decline/timeout/accept integrations | SOURCE_TESTED |
| Offer outcomes are exact and auditable | seven-outcome domain constant and persistence check | SOURCE_TESTED |
| Reliability accounts for vehicle/system/provider/traffic/external causes | `driver_reliability_review`; `evaluateReliabilityAttribution` | SOURCE_TESTED |
| Temporary restriction is scoped, reviewed and not guilt | existing restriction extended with basis/scope/history plus append-only review | SOURCE_TESTED |
| High-impact decisions have independent appeal | appeal aggregate, immutable evidence/resolution and independence guards | SOURCE_TESTED |
| Drivers are protected from Rider violence/harassment/discrimination/fraud/danger | Safety-owned RiderConductCase and authenticated Driver API | SOURCE_TESTED |
| Driver can safely terminate an unsafe Journey without rating harm | atomic termination service, Safety case, interrupted leg, cancelled assignment, continuity, break | SOURCE_TESTED |
| Incentives are transparent, auditable and non-coercive | Finance programme version, qualification and verified-current view | SOURCE_TESTED |
| Offboarding preserves outstanding obligations/history | constrained offboarding case/decision/transition records | SOURCE_TESTED |
| Staff adjudication, production evidence handling and legal review | deliberately absent pending authority/configuration | NOT_IMPLEMENTED |
