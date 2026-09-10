# Engineering Phase 0.71 — Authenticated Rider Booking-to-confirmation HTTP

The hosted PostgreSQL vertical-slice verifier now begins through production Fastify commands instead of inserting the new test Booking directly. An authoritative Rider session creates a Booking with pickup and destination snapshots, requests an explicitly configured development-fixture quote, confirms that quote and reads the resulting canonical journey progress.

Creation and confirmation are each replayed with the same idempotency key and must return the original response. A missing idempotency key fails before mutation, and another Rider receives the same non-disclosing not-found progress response used for absent Bookings.

The configured quote is synthetic and non-commercial. Production charging remains disabled, no provider is contacted, and every write is enclosed by the Phase 0.70 rollback-only transaction.
