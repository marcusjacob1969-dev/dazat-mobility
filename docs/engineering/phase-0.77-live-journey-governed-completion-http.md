# Engineering Phase 0.77 — Live-Journey Governed Completion HTTP

The hosted PostgreSQL vertical slice now completes the authenticated persisted Journey. After protected start, the assigned Driver submits fresh active-Journey telemetry at the Booking's canonical destination. The service verifies telemetry quality and movement plausibility before allowing the idempotent `ARRIVING` transition.

The completion command revalidates destination-approach and final-location evidence, derived service-context requirements, handover rules, operational holds and continuity cases. For this standard Booking, the successful transaction completes Journey, Booking, leg and assignment together and releases Driver availability from `ASSIGNED` to `AVAILABLE`.

Both arriving and completion replay idempotently. Rider and Driver progress converge on the completed Journey, while Finance remains truthful: production charging is disabled and `PAYMENT_PROVIDER_UNAVAILABLE` is the remaining action rather than a fabricated payment.
