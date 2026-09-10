# Engineering Phase 0.84 — Graceful API Runtime Shutdown

The API process now handles `SIGTERM` and `SIGINT` through one idempotent shutdown operation. It closes Fastify, allowing in-flight lifecycle work and the existing database-pool `onClose` hook to finish. Repeated signals cannot start overlapping close operations.

Unit tests prove handler registration, one-time close behavior and failure exit status. Hosted CI then stops the real packaged container with a bounded timeout and requires a clean zero exit code.

This checkpoint changes runtime lifecycle behavior only. It enables no external provider or operational mutation.
