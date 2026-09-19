# Phase 0.123 — Finance input and authentication boundaries

The Finance HTTP proof verifies malformed booking/payment identifiers, missing idempotency keys, and missing bearer authentication.

Unauthenticated requests remain 401, while authenticated malformed identifiers receive the appropriate 400 validation response.
