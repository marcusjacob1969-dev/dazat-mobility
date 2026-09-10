# Engineering Phase 0.83 — Containerised API-to-PostGIS Readiness

Hosted CI now runs the packaged API against an isolated PostGIS 16 container whose empty database is initialised by the repository's ordered migration directory. The API and database share a dedicated Docker network and use disposable CI-only credentials.

The gate first waits for PostgreSQL's own health signal, then starts the non-root API image. It requires `/health/live`, `/health/ready` with database `READY`, and the exact build checkpoint. Cleanup captures both logs and removes both containers and their network.

This is production-shaped packaging evidence, not a deployment. It publishes no image, provisions no cloud resource, uses no production data and enables no external provider.
