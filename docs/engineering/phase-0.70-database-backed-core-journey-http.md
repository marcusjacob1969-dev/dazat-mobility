# Engineering Phase 0.70 — Database-backed authenticated core-journey HTTP

Hosted CI now proves the demonstrable vertical slice through the actual Fastify routes, session authentication and migrated PostgreSQL/PostGIS schema rather than stopping at isolated service queries.

The verifier opens one transaction, inserts deliberately synthetic Rider, Driver, Control Room, Booking, Dispatch, Journey, RideCheck, Finance and fatigue-handover truth, and issues authenticated HTTP requests with `app.inject`. Rider, assigned Driver and the task-scoped operator must receive the same active-incident projection. Separate fixtures prove completed-and-captured closure and Rider-cancelled closure.

Negative cases prove that an unrelated Rider cannot probe another Booking, a Driver cannot access an unassigned Booking, an operator cannot inherit another operator's task scope, an expired bearer session fails closed and a missing credential returns the authentication-required contract.

The transaction rolls back in `finally`, including failed assertions. Production charging and every external provider remain disabled; this checkpoint proves composed read behavior, not launch readiness.
