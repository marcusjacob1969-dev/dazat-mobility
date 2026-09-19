# Engineering Phase 0.133 — Payment capture integrity

Phase 0.130 introduced the authoritative `finance.payment.captured_at` boundary. This phase promotes that invariant into the disposable PostgreSQL/Core Journey verification path.

## Proofs

- A captured Payment cannot have its authoritative `captured_at` removed.
- A Payment returned to an uncaptured state cannot retain a `captured_at` timestamp.
- Both mutations are attempted inside savepoints and rolled back, so the proof does not alter fixture state.
- The current checkpoint verifier advances through Phase 0.133.

This keeps capture timing authoritative at the database boundary rather than relying on API/UI interpretation.
