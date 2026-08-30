# Phase 0.12 Driver daily operations traceability

| Requirement | Source implementation | Status |
|---|---|---|
| Daily lifecycle from secure session through end shift remains explicit | `driver-daily-operations.ts`; `current_daily_operations_projection`; Driver UI | SOURCE_TESTED |
| BREAK and FINISHING_SOON are normal, non-punitive work intent | domain constants; availability/shift evidence; Driver and Control Room labels | SOURCE_TESTED |
| OFFLINE stops ordinary Driver-app location collection | availability database constraint; shift policy; projection | SOURCE_TESTED |
| Accepted scheduled commitments protect conflicting work | `scheduled_work_commitment`; Dispatch candidate and acceptance revalidation | SOURCE_TESTED |
| Offers show pickup distance/ETA, service context and expected/estimated Driver earning | immutable `driver_offer_disclosure`; Driver offer card | SOURCE_TESTED |
| Blind or incomplete offer acceptance fails closed | `evaluateDriverOfferDisclosure`; acceptance guard; database constraints | SOURCE_TESTED |
| Rider fare is not presented as Driver earning | domain and database hard-false guard; disclosure contract | SOURCE_TESTED |
| Weak-signal reconnect restores authoritative state | `connectivity_reconciliation`; authenticated reconciliation API | SOURCE_TESTED |
| Queued critical events are not assumed executed | hard-false persistence/contract; canonical resubmission routes | SOURCE_TESTED |
| Pickup uses the chosen Booking location | ArrivalCommunicationPlan projection joined to Booking pickup snapshot | SOURCE_TESTED |
| Arrival communication protects scoped recipients and contacts | immutable plan versions; direct-contact hard-false guard | SOURCE_TESTED |
| Current and forecast supply remain separate and capability-aware | `supply_demand_observation`; current projection; Driver API/UI | SOURCE_TESTED |
| Heatmaps do not guarantee earnings | domain/database/contract hard-false guards | SOURCE_TESTED |
| Homeward preference cannot bypass eligibility or use passenger attributes | immutable preference version and domain gate | SOURCE_TESTED |
| Driver Support categories and high-risk human escalation remain explicit | support aggregate/event; domain routing; authenticated API | SOURCE_TESTED |
| Low-distraction/voice/CarPlay/Android Auto provider execution | explicit unconfigured roadmap truth only | NOT_IMPLEMENTED |
| Real earning, ETA, provider, staffing and scheduling policy | deliberately disabled pending accountable decisions | NOT_IMPLEMENTED |
