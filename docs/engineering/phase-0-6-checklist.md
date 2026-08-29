# Engineering Phase 0.6 Checklist

Checkpoint: Live Journey Monitoring + Safety + Governed Completion Foundation
Status: SOURCE IMPLEMENTED / STATIC AND PURE-DOMAIN GUARDS VERIFIED / DATABASE AND APP RUNTIME UNVERIFIED

## Source implementation

- [x] Guarded `IN_PROGRESS → ARRIVING → COMPLETED` Journey and Booking transitions.
- [x] Purpose-scoped active Journey telemetry with device/server time, source, accuracy, confidence and read-time freshness.
- [x] Movement plausibility guards retain and label out-of-order observations and impossible jumps.
- [x] Authoritative reconnect snapshot includes Journey health, telemetry confidence, pending changes and completion requirements.
- [x] Append-only Journey timeline and contextual route-deviation signals.
- [x] Stop/destination requests use immutable location snapshots, optimistic Journey version and pending policy/pricing/acknowledgement state.
- [x] Stop request never mutates the route or fabricates pricing/Driver acknowledgement.
- [x] SOS, Silent Assistance and route concerns persist transactionally before external delivery.
- [x] Silent Assistance preserves `DO_NOT_AUTO_CALL` and has no external provider dependency on the persistence path.
- [x] Route concern severity is contextual and database-constrained against automatic misconduct findings.
- [x] Destination approach requires fresh, accurate, confident and movement-plausible telemetry within configured radius.
- [x] Completion requirement snapshot identifies standard, school, hospital and specialist contexts.
- [x] Missing or failed required handover blocks completion; ordinary app surfaces cannot mint authority.
- [x] Completion revalidates state, assignment, destination evidence, holds, continuity and handover.
- [x] Completion atomically closes Journey/Booking/leg/assignment and releases Driver to `AVAILABLE`.
- [x] Completion explicitly reports `paymentInitiated: false`.
- [x] Rider, Driver and Control Room surfaces expose uncertainty and governed boundaries without raw Safety facts.
- [x] OpenAPI documents all Phase 0.6 commands and signal paths.

## Verification completed here

- [x] Phase 0.6 structural/security verifier passes.
- [x] Pure movement plausibility and destination evidence tests pass.
- [x] Standard completion and required/failed-handover guard tests pass.
- [x] Silent Assistance, route concern severity and no-auto-misconduct tests pass.
- [x] Journey completion and Driver availability state-machine tests pass.
- [x] Node TypeScript syntax checks pass for non-JSX Phase 0.6 modules.
- [x] OpenAPI YAML parses and repository whitespace/error checks pass.

## Not yet executed or claimed

- [ ] Run migrations 0001–0006 against PostgreSQL 16 + PostGIS.
- [ ] Exercise concurrent telemetry, Safety, route-request, ARRIVING and completion commands against PostgreSQL locks and constraints.
- [ ] Compile Fastify, Expo and Vite workspaces with installed dependencies.
- [ ] Run Rider/Driver/Control Room end-to-end tests with device disconnect/reconnect and authenticated runtime data.
- [ ] Implement authorised handover recording for school, hospital and specialist operating models.
- [ ] Implement Safety acknowledgement, response coordination, restricted-role access and delivery adapters.
- [ ] Implement approved route repricing, communication, Driver acknowledgement and route-application workflows.
- [ ] Validate telemetry speed/radius/confidence thresholds, data retention and Safety handling with accountable owners.
- [ ] Complete security/adversarial testing, secrets management, observability and incident rehearsal.

This checkpoint is executable source evidence, not production readiness, a public service launch, Safety sign-off, safeguarding approval, licensing/insurance approval or payment certification.
