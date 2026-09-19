# Phase 0.120 — Core Journey input boundaries

The database-backed HTTP verifier now proves that the Rider, Driver and task-scoped Control Room Core Journey routes reject malformed UUID path parameters with explicit 400 validation responses.

The Control Room route is checked for both malformed booking and malformed controlled-handover identifiers. The unauthenticated malformed-booking request is also checked to ensure authentication remains the first boundary and does not disclose route validation details to unauthenticated callers.

This phase adds verification only. No route authority, database query, operational mutation, payment provider, communications provider or external mobility provider is enabled.
