# Foundation traceability

This checkpoint implements engineering foundations derived from the v0.4 architecture rather than claiming end-user feature completion.

| Foundation rule | Code/evidence in checkpoint |
|---|---|
| One fact, one owner | `docs/architecture/domain-ownership.md`, schema separation |
| Modular monolith allowed, boundaries required | `ADR-0001`, workspace layout |
| PostgreSQL/PostGIS authoritative | `compose.yaml`, `database/migrations/0001_foundation.sql` |
| Redis is derived | `compose.yaml`, ADR |
| Person != UserAccount != RiderProfile != DriverProfile | migration tables + `packages/contracts` |
| Canonical Booking state vocabulary | DB enum + `packages/domain/src/booking-status.ts` |
| Booker/passenger/payer/guardian separate | BookingParty enum/table + contracts |
| Transactional outbox | `booking.outbox_message` migration |
| Append-only state history | `booking.booking_state_transition` + DB trigger protection |
| External REST/OpenAPI | `openapi/dazat-api.yaml` |
| Health/readiness distinction | API skeleton + OpenAPI |
| DAZAT-owned visual language | `packages/design-system/src/tokens.ts` |
