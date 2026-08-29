# ADR-0006: Live Journey, Safety Signals and Governed Completion

Status: Accepted for Engineering Phase 0.6 source checkpoint
Date: 2026-08-29

## Context

Phase 0.5 ends only after a valid RideCheck and backend-authorised transition to `IN_PROGRESS`. The Master Blueprint requires the active Journey to preserve truth under weak connectivity, treat route deviations contextually, keep Safety controls immediately available, govern route changes, and prevent silence, disconnect, a map animation or an unauthorised handover from becoming completion.

## Decision

1. Live monitoring begins only for the assigned Driver after the authoritative Journey reaches `IN_PROGRESS`; `ARRIVING` remains active until governed completion succeeds.
2. Active location observations are append-only and purpose-scoped. They retain source, device/server time, accuracy, confidence and connectivity state. Out-of-order points and impossible jumps are retained as degraded evidence, not silently accepted or erased.
3. Rider and Driver reads use an authoritative snapshot. A reconnecting client replaces speculative local state and never infers completion from silence or stream loss.
4. Journey health is a derived operational projection: `NORMAL`, `ATTENTION`, `AT_RISK` or `INCIDENT`. Restricted Safety facts remain in the Safety owner; general Journey and Control Room projections expose only the minimum operational signal.
5. SOS, Silent Assistance and route concerns are committed in the same local transaction as a restricted Safety outbox record. No external provider is required for canonical persistence. Silent Assistance always sets `do_not_auto_call_reporter=true`.
6. A route concern creates contextual route-deviation evidence with severity and confidence. The schema constrains `misconduct_finding=false`; investigation and any future finding require a separate authorised workflow.
7. Stop and destination requests capture an immutable requested location, expected Journey version and actor. The active route is not mutated: the request remains `PENDING_POLICY_REVIEW` until pricing, authority, communication and Driver acknowledgement workflows exist and succeed.
8. The assigned Driver may enter `ARRIVING` only with fresh, accurate, confident, movement-plausible location evidence within the configured destination-approach radius. The command snapshots completion requirements from the Booking.
9. Standard completion requires `ARRIVING`, an active assignment, accepted destination evidence, no active completion hold and no open continuity case. School, hospital and specialist contexts additionally require an authorised handover; a failed or missing handover blocks completion.
10. Completion atomically closes Journey, Booking, JourneyLeg and DriverAssignment, records immutable completion evidence, and uses a completion-only guard to move Driver availability from `ASSIGNED` to `AVAILABLE`. The ordinary availability API cannot release active work. Completion explicitly does not initiate payment.
11. Handover persistence is modelled, but no ordinary Rider/Driver/Control Room endpoint can create authorised handover evidence. That command waits for the staff/school/specialist authority model rather than weakening the gate.

## Consequences

- Weak or suspicious telemetry reduces confidence without becoming automatic Driver misconduct.
- Safety intent survives downstream delivery failure and Silent Assistance cannot be converted into an automatic call to its reporter.
- A requested stop is visible and auditable before any commercial or operational application, while the route remains unchanged.
- School and other governed service contexts fail closed at completion until an authorised handover path is implemented.
- Driver availability is released only by the completion command, not by the ordinary availability endpoint.
- Payment and ledger state remain separate future owners; Phase 0.6 cannot imply capture, settlement or payout.
- PostgreSQL/PostGIS migration execution, concurrency tests, full dependency compilation, device telemetry and end-to-end Safety delivery remain explicit verification work.
