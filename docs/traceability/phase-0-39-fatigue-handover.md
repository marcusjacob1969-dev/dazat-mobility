# Phase 0.39 active-Journey fatigue-handover traceability

| Requirement | Implementation evidence |
|---|---|
| One continuity aggregate | Unique fatigue-observation link in `operations.driver_fatigue_handover` |
| Canonical context cannot drift | Immutable hold, Support case, Journey, assignment and Driver references |
| Passenger continuity remains mandatory | Database-checked `passenger_continuity_required = true` |
| Initial request is auditable | `REQUESTED` transition with Driver actor and fatigue evidence reference |
| Operational facts remain separate | Six guarded lifecycle states rather than one completed boolean |
| No transition shortcuts | Database update guard and next-version requirement |
| Evidence-backed claims | Replacement assignment, passenger-transfer and safe-stop evidence constraints |
| Retry-safe response | Existing fatigue-report deduplication returns `controlledHandoverId` |
| No fictional response | Creation leaves status REQUESTED and does not release the Safety hold |
