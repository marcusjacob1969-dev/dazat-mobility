# Phase 0.91 — Restricted Container Traceability

## Requirement

The packaged API runtime must use least-privilege container settings in hosted verification and must not silently regress to privileged execution.

## Evidence

- The API image is configured and verified to run as the unprivileged `node` user.
- Hosted verification starts the API with a read-only root filesystem.
- Writable temporary storage is limited to `/tmp` with `noexec` and `nosuid`.
- All Linux capabilities are dropped and `no-new-privileges` is enabled.
- The Phase 0.91 source verifier rejects privileged mode, capability additions and explicit seccomp/AppArmor disablement.
- Liveness, database readiness, exact build checkpoint and clean shutdown remain mandatory in the same hosted container gate.

## Boundary

These controls reduce container attack surface but do not constitute a complete host or workload security model. Provider credentials, production deployment and operational mutations remain separately governed and disabled.
