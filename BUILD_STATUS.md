# DAZAT Mobility — Build Status

## Current checkpoint

**Engineering Phase 0.91 — Restricted API Container Runtime**

Status: **SOURCE IMPLEMENTED / PHASE 0.91 VERIFIER ADDED / HOSTED CONTAINER RESTRICTION GATE CONFIGURED / PRODUCTION PROVIDERS AND OPERATIONAL MUTATIONS DISABLED**

Phase 0.91 makes the packaged API container's runtime confinement an explicit executable boundary. Hosted CI starts the API with a read-only root filesystem, a constrained `/tmp` tmpfs, all Linux capabilities dropped and `no-new-privileges` enabled, while retaining the unprivileged `node` image user, liveness/readiness checks and clean shutdown requirement. The phase verifier rejects privileged mode, capability additions and explicit seccomp/AppArmor disablement. These controls are runtime hardening measures and do not replace host, kernel, image, dependency or application security.

Earlier checkpoints remain preserved through Phase 0.90, including pinned container manifests, production API SBOM/vulnerability evidence, pinned CI actions, bounded CI concurrency and governed weekly dependency monitoring.

DAZAT continues to use the frozen v0.4 PRE-WORK COMPLETE blueprint. No Ventora source code is required by this repository. Production providers, payment execution, telephony, messaging and operational mutations remain disabled unless separately governed and evidenced.
