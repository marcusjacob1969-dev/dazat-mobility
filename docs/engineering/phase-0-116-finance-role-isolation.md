# Phase 0.116 — Finance role isolation

The HTTP/PostgreSQL integration proof now checks that Finance projections remain role-scoped after a completed Journey:

- Rider access to Driver earnings is rejected.
- Driver access to the Rider receipt for the completed booking is rejected.
- The positive completed Journey Finance proof remains intact.

This preserves the separation between Rider financial history and Driver earnings rather than relying on UI hiding.
