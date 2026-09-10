# Engineering Phase 0.90 — Dependency Update Monitoring

Dependabot now checks the locked npm workspace, API container base image, local Compose services and pinned GitHub Actions every week.

Minor and patch npm updates are grouped to keep review noise bounded. Docker, Compose and workflow dependencies remain separate so image digests and action revisions can be reviewed deliberately against the full hosted verification gate.

This configuration does not auto-merge changes. Every proposed dependency update remains an explicit pull request and must preserve DAZAT's compilation, security, container, runtime, journey and PostGIS evidence.
