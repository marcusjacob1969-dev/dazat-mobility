# Engineering Phase 0.134 — Payment consistency trigger syntax repair

A review of the merged migration chain found that the second trigger function in `0034_payment_intent_consistency.sql` still used a single-dollar PostgreSQL function delimiter while its body contained the matching delimiter form expected by the migration.

This phase repairs that function to use PostgreSQL dollar quoting consistently and adds an explicit source-level verifier for both trigger functions.

The existing database invariant remains unchanged: Payment amounts/currency remain bounded by the authoritative PaymentIntent, and PaymentIntent amounts/currency cannot be reduced or changed inconsistently after Payments exist.
