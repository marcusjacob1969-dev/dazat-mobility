# Engineering Phase 0.34 — Driver fatigue safety

- [x] Treat fatigue as an independent Safety boundary, not a rating or misconduct shortcut.
- [x] Use explicit, versionable warning, rest-required and minimum-rest policy inputs.
- [x] Fail closed when authoritative duty-time evidence is missing.
- [x] Allow Driver-reported fatigue and observed drowsiness to trigger protection before a numerical limit.
- [x] Stop new offers and new Journey starts when rest is required.
- [x] Preserve an active passenger through controlled handover and Control Room escalation.
- [x] Never create an automatic Driver fault finding from fatigue evidence.
- [x] Reject invalid, unordered or non-positive policy boundaries.
- [x] Add executable tests for warning, limit, self-report, drowsiness, active-Journey continuity and missing evidence.

## Deliberately not activated

- No jurisdiction-specific hour limit is asserted by source code; production values require current legal, licensing, insurer and Safety approval.
- No camera/biometric drowsiness provider, real Control Room contact, automatic emergency contact or Driver restriction mutation is enabled.
- Production persistence and Dispatch/Journey wiring remain a following implementation stage after approved policy values and evidence sources exist.
