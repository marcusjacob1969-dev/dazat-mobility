# Engineering Phase 0.66 — Control Room journey UI

The Control Room web surface can now load and render the canonical core-journey projection through the task-scoped Phase 0.65 endpoint. Operators supply their current session, fatigue-handover scope and Booking reference; the backend remains the authority and rejects ID-only access.

The panel renders disposition, next action and every milestone. Session tokens use a password input, requests opt out of caching, identifiers are URL-encoded, errors replace stale progress, and no mutation control is exposed.
