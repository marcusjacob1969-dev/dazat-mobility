# DAZAT Mobility Build Status

**Checkpoint:** Engineering Phase 0.1 — Foundation Started  
**Implementation truth:** SOURCE CREATED / NOT PRODUCTION VERIFIED  
**Blueprint baseline:** v0.4 PRE-WORK COMPLETE

## Implemented in this checkpoint

- [x] Clean DAZAT-owned monorepo structure
- [x] Technology baseline captured as an ADR
- [x] Domain ownership map
- [x] PostgreSQL/PostGIS schema boundaries
- [x] Identity Person/UserAccount foundation tables
- [x] RiderProfile and DriverProfile foundation tables
- [x] Canonical Booking status enum
- [x] BookingParty role model
- [x] immutable LocationSnapshot foundation
- [x] BookingStateTransition append-only table
- [x] Booking-domain transactional outbox table
- [x] Domain-level Booking state vocabulary and guarded happy-path transition helper
- [x] Shared design tokens
- [x] API live/readiness/build-info route skeleton
- [x] Worker/outbox publisher skeleton
- [x] Rider / Driver / Control Room application shells
- [x] OpenAPI foundation
- [x] Offline verifier + domain tests

## Not yet implemented

- [ ] Authentication/passkeys/session security
- [ ] Account recovery / Shield step-up controls
- [ ] Rider onboarding and Mobility Passport
- [ ] Driver onboarding/compliance eligibility
- [ ] Quote/Pricing engine
- [ ] Booking persistence service/repository
- [ ] Dispatch engine / live driver supply index
- [ ] Journey / RideCheck execution
- [ ] Payment / append-only double-entry ledger
- [ ] Communications provider adapters
- [ ] Control Room live operations
- [ ] Safety / safeguarding engine
- [ ] Fleet / Organisation / School / Rescue specialist modules
- [ ] Production CI/CD, cloud accounts, secrets and observability
- [ ] Provider procurement and production credentials
- [ ] Load/security/accessibility evidence

## Important

This file is intentionally strict: a scaffold is not marked as a finished feature. Every item above moves to implemented only when code, tests and evidence exist.
