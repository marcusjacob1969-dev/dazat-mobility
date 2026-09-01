# Phase 0.34 fatigue-safety traceability

The triggering evidence supplied to the project described a fatal collision after a taxi Driver reportedly drove for twelve hours and fell asleep. This checkpoint converts that risk into an executable, provider-independent Safety boundary.

| Risk | Executable control |
|---|---|
| Long or un evidenced duty period | Missing evidence fails closed; configured duty boundary requires rest |
| Fatigue before the numerical boundary | Driver self-report and drowsiness signal independently require rest |
| More work offered after a hard stop | New offers and new Journey starts are denied |
| Passenger already onboard | Controlled handover, passenger continuity and Control Room escalation are required |
| Fatigue treated as guilt | Decision explicitly creates no Driver fault finding |
| Unsafe configuration | Boundaries must be positive safe integers in strict order |

The evaluator is in `packages/domain/src/driver-daily-operations.ts`; its executable scenarios are in `tests/domain/driver-daily-operations-source.test.mjs`.
