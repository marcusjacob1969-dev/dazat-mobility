# Phase 0.6 Blueprint Traceability

Truth labels follow Master Blueprint §83: `SOURCE_CREATED`, `SOURCE_TESTED`, `PARTIAL_SOURCE`, or `NOT_IMPLEMENTED`. No row claims production verification.

| Blueprint requirement / acceptance | Phase 0.6 evidence | Truth |
|---|---|---|
| Active monitoring begins only after protected start (`API-JRN-001`) | active telemetry command requires `IN_PROGRESS` or `ARRIVING` and the current assigned Driver | SOURCE_TESTED |
| Connectivity confidence is explicit (`JRN-CON-001`, `RT-RES-001`) | `LIVE/DELAYED/DEGRADED/STALE/UNKNOWN`, movement guards and `AUTHORITATIVE_SNAPSHOT` reconnect instruction | SOURCE_TESTED |
| Route deviations are contextual, graded and not automatic misconduct (`JRN-DEV-001`) | route severity domain function, append-only signal and database `misconduct_finding=false` constraint | SOURCE_TESTED |
| Stops/destination changes are explicit, versioned and governed (`JRN-CHG-001`) | immutable location snapshot, expected aggregate version, pending pricing/policy/Driver-ack states, routeChanged false | SOURCE_CREATED |
| Journey health is `NORMAL/ATTENTION/AT_RISK/INCIDENT` (`JRN-HLT-001`) | Safety-derived active projection and restricted Control Room view | SOURCE_CREATED |
| SOS remains immediately available and durable | `/v1/safety/signals/sos`, Safety transaction/dedupe/restricted outbox | SOURCE_CREATED |
| Silent Assistance preserves no-auto-call intent (`SAF-SIL-001`) | domain policy, persisted flag, API result and no provider call on canonical write path | SOURCE_TESTED |
| Route concern persists even without external provider delivery | local Safety event and restricted outbox commit before asynchronous delivery | SOURCE_CREATED |
| Material Journey actions are ordered and reconstructable (`AUD-001`) | append-only aggregate-sequenced `journey_event`, state histories, evidence and outboxes | PARTIAL_SOURCE |
| Critical commands revalidate actor/resource/state (`SEC-AUTH-001`) | active Driver or authorised Booking party checks plus row-locked Journey/Booking/assignment/leg | SOURCE_CREATED |
| Duplicate-prone commands are idempotent (`API-IDEM-001`) | request fingerprints for Journey/Safety commands and conflicting-key rejection | SOURCE_CREATED |
| Arrival at destination uses current evidence (`JRN-CMP-001`) | destination radius/quality/movement guard and immutable approach evidence | SOURCE_TESTED |
| Completion is governed and cannot be inferred from silence (`JRN-CMP-001`) | state/assignment/evidence/hold/continuity/handover decision and completion evidence | SOURCE_TESTED |
| School transport requires authorised handover (`XDT school handover`) | captured service context, handover record model and hard completion blocker | PARTIAL_SOURCE |
| Failed handover prevents completion | `HANDOVER_FAILURE_OPEN` and `HANDOVER_REQUIRED` pure guards plus transactional completion check | SOURCE_TESTED |
| Completion releases assignment and Driver atomically | assignment `COMPLETED`, leg/Booking/Journey `COMPLETED`, availability `ASSIGNED→AVAILABLE` | SOURCE_TESTED |
| Completion does not fabricate payment (`API-OWN-001`) | completion response/event explicitly set `paymentInitiated: false`; no Finance mutation | SOURCE_TESTED |
| Low-distraction active Rider/Driver UI and restricted Control Room | persistent Safety actions, concise health/telemetry labels, no raw Safety facts or direct mutation editor | SOURCE_CREATED |
| Authorised handover command and staff/school authority verification | schema and fail-closed gate only; endpoint deliberately absent | PARTIAL_SOURCE |
| Real routing/pricing application and external Safety delivery | governed pending states/outboxes only | NOT_IMPLEMENTED |

## Evidence commands

```sh
npm run verify:phase-0-6
npm run test:phase-0-6-domain
git diff --check
```

PostgreSQL/PostGIS migration execution, transaction concurrency, full dependency compilation, device behaviour and app E2E remain unverified and are listed in the Phase 0.6 checklist.
