## Phase 0.148 — Payment transition transaction provenance

Payment status changes now require immutable transition provenance created in the same PostgreSQL transaction as the status change. `provenance_transaction_id` records `txid_current()` and the database trigger rejects matching status records from another transaction.

The PostgreSQL/Core Journey verifier proves both rejection of mismatched transaction provenance and successful same-transaction status change. The proof rolls back afterwards.

This phase does not enable provider charging, capture, refund, or real-money behaviour.
