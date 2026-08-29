# Control Room application shell

The Control Room will consume authorised API/read models. It must never become an alternate database editor or a second source of Booking, Safety, Finance, Driver or Shield truth.

Phase 0.5 defines a read-only Journey projection contract with telemetry freshness and protected-start holds. Staff identity/role grants, Safety assessment and hold release are not implemented, so no internal mutation endpoint is exposed here.
