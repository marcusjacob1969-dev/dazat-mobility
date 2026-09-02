# Phase 0.36 fatigue self-report traceability

| Requirement | Implementation evidence |
|---|---|
| Driver can report fatigue without proving misconduct | `POST /v1/driver/fatigue-reports`; `driverFaultFindingCreated: false` |
| Duplicate submission is safe | `ReportDriverFatigue` command fingerprint and idempotent stored response |
| No passenger onboard | Availability moves to BREAK with append-only shift event |
| Passenger active | ASSIGNED state is retained; Safety hold and `HIGH_RISK_ACTIVE` Support case are created |
| Work stops immediately | Active fatigue observation feeds existing Dispatch and Journey-start hard gates |
| No pretend response | `externalServiceContacted: false`; human escalation is owned but not claimed completed |
| Reliable downstream processing | `driver.fatigue-self-reported` transactional outbox event |
