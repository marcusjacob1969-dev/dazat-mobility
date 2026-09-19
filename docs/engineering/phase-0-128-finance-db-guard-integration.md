# Phase 0.128 — Finance database guard integration proof

The core HTTP/PostgreSQL fixture now exercises the Phase 0.127 database trigger directly.

The proof attempts four invalid mutations against fixture PaymentIntents and requires PostgreSQL to reject each one:

1. enabling provider_action_attempted without provider references;
2. adding a provider reference without a provider action;
3. changing a CREATED intent to approved charging eligibility;
4. moving an intent to STATUS_UNKNOWN without reconciliation.

Each rejected mutation is isolated with a savepoint so the verifier can continue using the same transaction. This turns the Phase 0.127 source-level invariant into an executable database-backed regression proof.

No provider action or real payment is performed.