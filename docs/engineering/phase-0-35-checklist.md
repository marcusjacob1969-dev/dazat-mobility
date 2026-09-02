# Engineering Phase 0.35 — Fatigue runtime enforcement

- [x] Persist Driver fatigue observations separately from misconduct, ratings and restrictions.
- [x] Preserve observation identity/evidence and permit only governed ACTIVE-to-CLEARED transition.
- [x] Derive active shift, completed break and unresolved fatigue inputs through a server-owned projection.
- [x] Treat absent active-shift evidence as unsafe for candidate selection and Journey start.
- [x] Apply configurable warning, rest-required and qualifying-rest boundaries.
- [x] Reject invalid or unordered policy configuration.
- [x] Add fatigue Safety to the canonical Dispatch hard filter.
- [x] Re-evaluate fatigue before offer acceptance through the existing eligibility path.
- [x] Re-evaluate fatigue again immediately before protected Journey start.
- [x] Preserve a clean new shift transition from OFFLINE without inheriting missing-active-shift blockage.
- [x] Extend the disposable PostgreSQL migration chain to the fatigue evidence schema and projection.

## Provisional boundary

The default 480-minute warning, 600-minute rest requirement and 30-minute qualifying rest are a conservative DAZAT engineering policy for controlled development. They are not represented as a universal statutory limit and require current licensing, legal, insurer and Safety approval before production launch.

## Still disabled

- No camera, biometric or telematics drowsiness provider is approved or connected.
- No general staff editor can clear evidence.
- Active-Journey fatigue handover execution and real Control Room contact remain disabled until the governed operational command is implemented.
