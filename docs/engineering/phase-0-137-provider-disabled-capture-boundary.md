# Phase 0.137 — Provider-disabled capture boundary

## Purpose

Keep the finance surface explicitly provider-disabled: the API may prepare and inspect a PaymentIntent, but it must not expose a public capture, charge, or refund mutation path.

## Proofs

The HTTP/PostgreSQL Core Journey verifier probes the obvious capture/charge/refund endpoint shapes and requires HTTP 404 for each. It also scans the finance route and service source for forbidden provider-mutation entry points.

The proof is intentionally negative: absence of an API mutation surface is part of the productionChargingEnabled=false boundary.

## Scope

- No real-money charging.
- No provider capture action.
- No provider charge action.
- No provider refund action.
- Existing Payment/PaymentIntent read and provider-neutral preparation paths remain unchanged.

## Verification

Run npm run verify:phase-0-137 for wiring verification. The full verify:core-journey:http-postgres run exercises the HTTP 404 probes against the ephemeral PostgreSQL-backed API.