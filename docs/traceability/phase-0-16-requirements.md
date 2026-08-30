# Phase 0.16 Communications Engine final-closure traceability

| Blueprint §59 requirement / invariant | Source implementation | Status |
|---|---|---|
| Communications transports but never invents domain truth | closure constants, canonical request guard and persistence constraints | SOURCE_TESTED |
| Domain owners remain authoritative | ADR boundary and source-domain enum | SOURCE_TESTED |
| Canonical request required instead of direct provider calls | `evaluateCanonicalCommunicationRequest` and `communication_request_contract` | SOURCE_TESTED |
| Idempotency and immutable source event required | request guard, envelope primary key and contract uniqueness | SOURCE_TESTED |
| Raw phone/email resolved later from authorised contact points | raw-contact hard-false boundary | SOURCE_TESTED |
| Approved payload variables only; no source-object dump | domain blocker and JSON-array persistence constraint | SOURCE_TESTED |
| Priority affects delivery but not data access | hard-false domain/API/database fields | SOURCE_TESTED |
| Current state version suppresses stale messages | request and route decisions plus database constraints | SOURCE_TESTED |
| Common versioned event envelope | `canonical_event_envelope` and envelope evaluator | SOURCE_TESTED |
| Duplicate events are deduplicated | envelope evaluator and immutable event ID | SOURCE_TESTED |
| Occurrence and recording time remain separate | envelope fields and domain truth | SOURCE_TESTED |
| Unsupported critical schema fails closed | envelope blocker and supported-schema constraint | SOURCE_TESTED |
| Fourteen P0/P1 event contracts are named and versioned | critical-event constant and `communication_event_contract_version` | SOURCE_TESTED |
| Fifteen conceptual API operations are catalogued | operation constant and `communication_api_contract_version` | SOURCE_TESTED |
| All twenty P0 requirement IDs are tracked | P0 constant and `communication_p0_requirement_version` | SOURCE_TESTED |
| Passenger/booker/payer/guardian/school roles stay distinct | recipient permission evaluator and persistence enum | SOURCE_TESTED |
| Driver sees minimum operational data | Driver scope blocker and client truth | SOURCE_TESTED |
| Organisation and rescue partner scope is purpose-limited | recipient permission evaluator | SOURCE_TESTED |
| Control Room access requires role and active task | evaluator and database constraint | SOURCE_TESTED |
| Ten-step channel/fallback decision order | `decideCommunicationsClosureRoute` and `delivery_path_resolution` | SOURCE_TESTED |
| Provider acceptance and SENT are not delivery | route hard-false outputs and persistence constraint | SOURCE_TESTED |
| Fallback revalidates source state and respects caps | route evaluator and database checks | SOURCE_TESTED |
| Critical delivery failure becomes owned operational work | route action and existing CommunicationFailureCase | SOURCE_TESTED |
| Telephone/voice use canonical owners and low confidence hands off | final closure invariants plus Phase 0.14 source | SOURCE_TESTED |
| Voice AI cannot decide high-risk outcomes | hard-false closure boundary | SOURCE_TESTED |
| Shield outage pauses risky changes | degraded-mode decision and persistence check | SOURCE_TESTED |
| Essential Journey/Safety/safeguarding remains available | degraded-mode decision | SOURCE_TESTED |
| Recovery discards stale and duplicate work | degraded-mode decision and acceptance cases | SOURCE_TESTED |
| Communications data is minimised and not broadly indexed | closure hard-false boundary and envelope constraint | SOURCE_TESTED |
| All eighteen end-to-end scenarios are explicit | acceptance catalogue enum/table and 29 source tests | SOURCE_TESTED |
| Silent Assistance no-call survives acceptance | scenario-specific gate | SOURCE_TESTED |
| Payment STATUS_UNKNOWN never asks blind retry | scenario-specific gate | SOURCE_TESTED |
| School handover never degrades to ordinary no-show | scenario-specific gate | SOURCE_TESTED |
| Staff snooping is denied or break-glass audited | scenario-specific gate | SOURCE_TESTED |
| All thirteen launch gates are explicit | launch-gate enum/table/read projection | SOURCE_TESTED |
| Gate evidence is separate from accountable approvals | readiness evaluator and projection | SOURCE_TESTED |
| Endpoint availability grants no domain authority | hard-false capability projection | SOURCE_TESTED |
| Unmanaged provider bypass is prohibited | hard-false domain/API boundary | SOURCE_TESTED |
| Provider execution, closure mutation and pilot launch | disabled pending all gates and accountable decisions | NOT_IMPLEMENTED |
