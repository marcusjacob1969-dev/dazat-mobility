# Control Room application shell

The Control Room will consume authorised API/read models. It must never become an alternate database editor or a second source of Booking, Safety, Finance, Driver or Shield truth.

Phase 0.6 adds read-only Journey health, connectivity confidence, route concern and completion/handover expectations without copying raw restricted Safety facts. Staff role grants, Safety response, hold release and authorised handover commands are not implemented, so no internal mutation endpoint is exposed here.

Phase 0.7 documents the Finance projection boundary: no direct balance edits, no blind retry of `STATUS_UNKNOWN`, and no collapsing PaymentIntent, Payment, DriverEarning or Payout into one state.
