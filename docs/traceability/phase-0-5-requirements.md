# Phase 0.5 Blueprint Traceability

Implementation truth labels follow Master Blueprint §83: `SOURCE_CREATED`, `SOURCE_TESTED`, `PARTIAL_SOURCE`, or `NOT_IMPLEMENTED` for this checkpoint. No row claims production verification.

| Blueprint requirement / acceptance | Phase 0.5 evidence | Truth |
|---|---|---|
| Backend owns Booking/Journey transitions; invalid shortcuts rejected (§49) | `booking-status.ts`, `journey.ts`, locked transactional service commands, append-only transition tables | SOURCE_TESTED |
| RideCheck before ordinary Journey start (§49–50) | `canStartJourney`, verified current-leg RideCheck query, `/journeys/{id}/start` | SOURCE_TESTED |
| Location carries timestamp/source/confidence; stale is not exact truth (`LOC-001`) | dedicated observation contract/table plus read-time `evaluateLocationEvidence` | SOURCE_TESTED |
| Location telemetry has purpose/retention/freshness fields (`RT-LOC-001`) | `driver_location_observation` purpose, retention class, device/server times, accuracy, confidence and telemetry state | SOURCE_CREATED |
| Arrival considers age/accuracy and geofence evidence (§45, §68.18) | `evaluateArrivalEvidence`, immutable `arrival_evidence`, configured pickup radius | SOURCE_TESTED |
| Journey and RideCheck data are canonical (`API-OWN-001`) | Journey-owned state, session, attempt, evidence, hold and outbox tables; no generic status PATCH | SOURCE_CREATED |
| Critical Journey commands enforce authoritative state and RideCheck (`API-JRN-001`) | row locks, guarded transitions, assignment/eligibility/hold/location revalidation | SOURCE_TESTED |
| Critical commands revalidate resource/state authorisation (`SEC-AUTH-001`) | authenticated active-journey capability plus active Driver or authorised Booking-party checks | SOURCE_CREATED |
| Duplicate-prone writes define idempotency (`API-IDEM-001`) | actor/subject-scoped command dedupe; client observation UUID | SOURCE_CREATED |
| Each RideCheck session/attempt separately recorded (`DAT-RCK-001`) | `ridecheck_session`, append-only `ridecheck_attempt`; leg/assignment/vehicle binding | SOURCE_CREATED |
| Material actions have reconstructable audit context (`AUD-001`) | append-only Booking/Journey/Hold/Safety transitions and transactional outboxes | PARTIAL_SOURCE |
| RideCheck mismatch blocks, protects and creates required path without guilt finding (§66.16, `XDT-009`) | bounded lock, active hold, canonical SafetyEvent, `finding_status=NOT_ASSESSED` | SOURCE_TESTED |
| Normal support cannot bypass protected start (§81 acceptance 4) | no bypass route; active hold is a hard start blocker; Control Room read-only projection contract | SOURCE_TESTED |
| Rider/Driver reconnect reconciles owner truth (`RT-001`, `RT-RES-001`) | authorised snapshot endpoints with projection time and mutation revalidation flag | PARTIAL_SOURCE |
| Stale/unknown location is labelled in UI (`DSN-MAP-001`) | Rider/Driver/Control Room copy and live projection telemetry states | SOURCE_CREATED |
| Assisted, QR, guardian/school and accessibility-aware RideCheck variants (§49, §66.16) | database method vocabulary preserved; only self-booker PIN command implemented | PARTIAL_SOURCE |
| Replacement vehicle requires a new RideCheckSession (§66.16) | session is bound to current JourneyLeg/assignment/Driver/vehicle; replacement workflow itself deferred | PARTIAL_SOURCE |

## Evidence commands

```sh
npm run verify:phase-0-5
npm run test:phase-0-5-domain
git diff --check
```

PostgreSQL/PostGIS migrations, concurrency behaviour, full workspace compilation and app E2E remain unverified in this environment and are listed explicitly in the Phase 0.5 checklist.
