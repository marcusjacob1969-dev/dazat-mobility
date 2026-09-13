# Phase 0.101 — Journey UI semantics

Phase 0.101 adds a shared, pure presentation mapper for the canonical Core Journey `nextAction` semantics.

## Purpose

Rider, Driver and Control Room need human-readable journey states without creating a second state machine in the clients. The mapper converts authoritative backend intent into a stable UI phase, label, tone and optional action label.

## Rules

- Core Journey remains authoritative.
- The mapper performs no network I/O and cannot mutate Booking, Dispatch, Journey, Safety or Finance state.
- `SUPPORT_REQUIRED` is rendered as a danger state rather than a normal journey success.
- `PAYMENT_PROVIDER_UNAVAILABLE` remains a warning and never becomes a charge-success state.
- `JOURNEY_CLOSED` is the only mapped completion state.
- RideCheck remains a protected pickup boundary.
- Unknown or newly introduced backend actions fail to a neutral preparing state unless an interruption reason or completed journey explicitly requires a safer interpretation.

## Next integration

The Rider, Driver and Control Room clients should consume this shared mapping while continuing to obtain the underlying projection through their existing authenticated, role-scoped APIs. Client-side labels must never be used to authorise a mutation.
