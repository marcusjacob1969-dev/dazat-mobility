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

## 0.2 Identity and account foundation — NEXT

- Person and UserAccount repositories
- phone/email verification boundary contracts
- session/device model
- passkey-ready authentication abstraction
- RiderProfile creation
- DriverProfile creation without conflating account identity
- audit trail
- high-risk recovery event hooks for DAZAT Shield

## 0.3 First Booking vertical slice

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
