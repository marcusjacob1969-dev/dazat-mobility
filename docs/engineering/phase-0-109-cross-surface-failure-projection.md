# Phase 0.109 — Cross-surface failure projection proof

Phase 0.109 strengthens the demonstrable Rider → Driver → Control Room vertical slice by proving that a real persisted Safety interruption produces the same canonical Core Journey projection across all three operational surfaces.

The PostgreSQL-backed HTTP verifier now checks the same incident booking through:

- Rider booking-scoped Core Journey HTTP
- Driver booking-scoped Core Journey HTTP
- Control Room task-scoped Core Journey HTTP

The verifier requires identical milestone collections and the same `SUPPORT_REQUIRED` next action. It also verifies that the Journey milestone is blocked rather than allowing any client to infer or override operational state.

## Safety boundary

The failure remains backend-authoritative. An active Safety hold and Support case prevent normal Journey progression; Control Room visibility does not grant direct database-editing authority or a bypass around Safety/handover evidence.

No real payment, provider, communications or external emergency-service execution is introduced.
