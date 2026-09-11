# Engineering Phase 0.91 — Restricted API Container Runtime

Phase 0.91 makes the production API container's runtime confinement an explicit, executable checkpoint.

The hosted container gate now starts the API with a read-only root filesystem, a small `tmpfs` at `/tmp` with `noexec` and `nosuid`, all Linux capabilities dropped, and Docker's `no-new-privileges` security control enabled. The image continues to run as the unprivileged `node` user and must still pass dependency-independent liveness, database-backed readiness, exact build metadata and clean shutdown verification.

The verifier also rejects obvious confinement regressions such as privileged mode, added capabilities, disabled seccomp or disabled AppArmor confinement. This is a runtime-hardening boundary, not a claim that the container is a complete security boundary by itself.

No provider credentials, external operational mutations or production deployment are enabled by this phase.
