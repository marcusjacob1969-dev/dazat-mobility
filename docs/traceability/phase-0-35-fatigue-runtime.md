# Phase 0.35 fatigue runtime traceability

| Boundary | Runtime evidence |
|---|---|
| Durable fatigue truth | `driver.driver_fatigue_observation` with immutable evidence and governed clearing |
| Rest/duty truth | `driver.current_fatigue_safety_projection` over active shift and completed BREAK evidence |
| Candidate filtering | `FATIGUE_SAFETY_BLOCKED` in canonical Dispatch eligibility |
| Acceptance race/time passage | Offer acceptance reuses current server-side eligibility and fatigue evaluation |
| Journey-start time passage | Protected start queries the fatigue projection and blocks independently |
| Configuration safety | Ordered bounded environment configuration plus runtime tests |
| Database proof | Guarded disposable PostgreSQL runner applies ordered migrations 0001–0021 |

Fatigue evidence never becomes an automatic Driver fault finding. Missing duty evidence fails closed, and a new OFFLINE-to-online shift creates fresh authoritative duty truth.
