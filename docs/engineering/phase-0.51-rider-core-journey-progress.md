# Engineering Phase 0.51 — Rider core-journey progress

The Rider application now consumes the authenticated Phase 0.50 progress projection and renders each canonical milestone with its current state and the next action.

The UI does not synthesize progress from button presses. Refresh always returns to server-owned Booking, Pricing, Dispatch, Journey, RideCheck and Finance truth. Blocked milestones remain visible, and the screen explicitly states that production charging is disabled.
