# Engineering Phase 0.136 — Payment consistency database proof

This phase promotes the Payment/PaymentIntent consistency rules from migration-source checks into the disposable PostgreSQL/Core Journey verification path.

The proof attempts invalid currency, authorised amount, captured amount, refund amount, captured/refunded status, and PaymentIntent amount/currency/status mutations. Each mutation is expected to be rejected and is isolated with a savepoint so fixture state is preserved.
