# Engineering Phase 0.82 — Hosted API Container Runtime Smoke Test

The API container gate now proves runtime behavior in addition to image construction. CI inspects the built image's configured user, starts the exact commit-tagged image with disposable provider-disabled configuration, waits for liveness and verifies build metadata.

The liveness check deliberately has no database dependency. Database readiness remains a separate `/health/ready` contract and is already tested against disposable PostGIS. A cleanup trap captures container logs and removes the container on both success and failure.

No registry push, cloud deployment, production secret or external provider is involved.
