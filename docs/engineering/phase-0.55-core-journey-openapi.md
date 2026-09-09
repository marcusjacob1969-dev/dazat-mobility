# Engineering Phase 0.55 — Core-journey OpenAPI contract

The Rider and Driver core-journey progress endpoints are now part of the public API description. Both return the same eight canonical milestones while retaining separate Booking-party and Driver-assignment authorization.

The contract explicitly excludes RideCheck secrets and passenger financial detail from the Driver view and keeps production charging disabled.
