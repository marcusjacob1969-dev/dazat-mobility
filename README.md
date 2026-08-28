# DAZAT Mobility

Production engineering repository for DAZAT Mobility, built cleanly from the **DAZAT Mobility Master Blueprint v0.4 — PRE-WORK COMPLETE** baseline.

> Build once. Build properly. Build to last.

## Current engineering checkpoint

**Phase 0.2 — Identity & Account Foundation**

This repository is now beyond a screen-only prototype. It contains the authoritative engineering foundation for:

- Rider mobile app (Expo / React Native / TypeScript)
- Driver mobile app (Expo / React Native / TypeScript)
- Control Room web app (React / TypeScript)
- Platform API (Node.js / TypeScript / Fastify)
- Background worker/event process
- PostgreSQL + PostGIS authoritative transactional storage
- Redis-compatible derived/ephemeral state
- Shared domain/contracts/design-system packages
- Booking state-machine foundation and transactional outbox
- Person / UserAccount / RiderProfile / DriverProfile separation
- Typed contact points and separate verification history
- Passkey-ready authenticators, device trust, revocable sessions and explicit recovery state
- A real idempotent account-registration API source path

## Phase 0.2 registration behaviour

`POST /v1/identity/registrations` creates, in one database transaction:

1. a minimal `Person` identity anchor;
2. a **PENDING** `UserAccount`;
3. a preferred-name record;
4. a typed Email/Mobile `ContactPoint`;
5. the requested Rider and/or Driver profile;
6. append-only account lifecycle evidence;
7. an Identity outbox event; and
8. an idempotency response record.

It deliberately returns:

`CONTACT_VERIFICATION_REQUIRED`

It **does not** claim the contact is verified, issue a login session, complete a passkey ceremony, or make a Driver eligible to work.

## Architecture rules already enforced

- One authoritative owner per business fact.
- Server/domain owners decide state transitions; clients request commands.
- PostgreSQL is transactional truth; Redis/search/cache are rebuildable projections.
- Cross-domain writes go through commands/events rather than convenience table mutation.
- Authoritative state + outbox event commit atomically.
- Duplicate commands/events must be safe.
- Passkey private keys are never stored by DAZAT.
- Session bearer secrets must be stored only as strong hashes/references.
- Device trust is risk context, not permanent identity proof.
- Account recovery changes authentication authority, not historical journeys/finance.
- A person may be both Rider and Driver without manufacturing duplicate human identity.
- Driver registration is not Driver compliance approval.

## Repository map

```text
dazat-mobility/
├── apps/
│   ├── rider/
│   ├── driver/
│   └── control-room/
├── services/
│   ├── api/
│   └── workers/
├── packages/
│   ├── domain/
│   ├── contracts/
│   └── design-system/
├── database/
│   ├── migrations/
│   └── seeds/
├── docs/
│   ├── architecture/
│   ├── engineering/
│   └── traceability/
├── openapi/
├── scripts/
└── tests/
```

## Local verification

The checkpoint has a no-network core verification path:

```bash
npm run check
```

It currently verifies the foundation, Phase 0.2 security/model checks and the domain test suite.

A full runtime build additionally requires workspace dependencies and a PostgreSQL/PostGIS runtime. This execution environment had no external npm DNS access and no PostgreSQL/Docker runtime, so those integration claims remain explicitly open in `BUILD_STATUS.md` rather than being faked.

## Local runtime target

Once dependencies are available:

```bash
cp .env.example .env
docker compose up -d
npm install
npm run check
```

Then apply the migrations in order and run the API/mobile clients. Production deployment will use managed infrastructure rather than this local compose file.

## Next engineering checkpoint

**Phase 0.3 — Verified Authentication & Session Boundary + First Account-to-Booking Slice**

The next work is to wire real contact verification/passkey ceremonies and authenticated session enforcement, then drive an authenticated Rider through the first canonical booking sequence toward `READY_FOR_DISPATCH`.

See `BUILD_STATUS.md`, `docs/architecture/ADR-0002-identity-account-foundation.md`, and `docs/traceability/identity-account-requirements.md` for exact implementation/non-implementation status.
