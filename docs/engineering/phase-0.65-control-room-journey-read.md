# Engineering Phase 0.65 — Task-scoped Control Room journey read

Control Room can now read the same canonical core-journey progress projection used by Rider and Driver, but only through a current `DRIVER_FATIGUE_HANDOVER` task scope owned by the authenticated operator.

The backend revalidates the task, role assignment, operator identity, validity window, fatigue handover, Journey and Booking relationship in one query. An absent Booking and an out-of-scope Booking return the same not-found response. The projection contains no RideCheck secret, passenger identity/contact, precise location or restricted Safety narrative.

This is read-only and grants no general Journey, Safety, Finance or database-edit authority.
