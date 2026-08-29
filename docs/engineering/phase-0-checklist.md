# Engineering Phase 0 checklist

## 0.1 Repository foundation — COMPLETE IN THIS CHECKPOINT

- Monorepo
- Node/TypeScript baseline
- mobile/web/service shells
- domain/contracts/design-system packages
- local PostGIS + Redis definition
- migration foundation
- OpenAPI baseline
- offline verifier/tests

## 0.2 Identity and account foundation — COMPLETE IN SOURCE CHECKPOINT

- Person and UserAccount repositories
- phone/email verification boundary contracts
- session/device model
- passkey-ready authentication abstraction
- RiderProfile creation
- DriverProfile creation without conflating account identity
- audit trail
- high-risk recovery event hooks for DAZAT Shield

## 0.3 First Booking vertical slice — COMPLETE IN SOURCE CHECKPOINT

- create draft Booking
- immutable pickup/dropoff LocationSnapshots
- BookingParty roles
- BookingRequirement persistence
- quote request boundary
- confirm Booking with idempotency
- transactionally append state + outbox event
- progress to READY_FOR_DISPATCH
- query Booking state through authorised API

## Exit test for the first vertical slice

A test user can create an account, create a rider profile, create a booking for themselves or another authorised passenger, receive a quote, confirm it once despite duplicate requests, and retrieve the canonical server state. No UI or client can directly force a later state.

## 0.4–0.6 Journey spine — COMPLETE IN SOURCE CHECKPOINTS

- hard-filtered Dispatch and atomic assignment
- evidenced pickup and protected RideCheck start
- live Journey telemetry, Safety signals and governed changes
- destination evidence, handover gates and governed completion

## 0.7 Finance truth foundation — COMPLETE IN SOURCE / CHARGING DISABLED

- provider-neutral PaymentIntent and Payment states
- `STATUS_UNKNOWN` reconciliation and no blind retry
- integer minor-unit/currency constraints
- balanced append-only ledger with reversal correction
- separate Refund, DriverEarning, Payout and payout destination change
- truthful Rider/Driver/Control Room projections
- no provider call, capture, refund, settlement or payout execution
