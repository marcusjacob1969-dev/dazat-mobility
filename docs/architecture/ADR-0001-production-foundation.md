# ADR-0001 — Production foundation

**Status:** Accepted for Engineering Phase 0  
**Date:** 2026-08-28

## Context

The DAZAT Mobility v0.4 blueprint specifies a managed, proven infrastructure approach, a modular monolith before premature microservices, PostgreSQL/PostGIS for authoritative transactional data, React Native + TypeScript for mobile, React + TypeScript for web, Node.js + TypeScript for the initial backend, Redis-compatible derived state, durable async delivery and containerised deployment.

## Decision

Start the production build as an **npm-workspaces TypeScript monorepo** with explicit domain boundaries:

- `apps/rider` — React Native + Expo shell
- `apps/driver` — React Native + Expo shell
- `apps/control-room` — React + TypeScript web shell
- `services/api` — Node.js + TypeScript modular-monolith API
- `services/workers` — background/outbox/reconciliation workers
- `packages/domain` — provider/UI-independent domain vocabulary and invariants
- `packages/contracts` — API/event contract types
- `packages/design-system` — DAZAT-owned semantic UI tokens
- `database` — versioned PostgreSQL/PostGIS migrations

The first backend deployment remains a modular monolith. Logical modules own their repositories/tables; modules may not directly write another module's authoritative tables.

## Framework baseline

- API: Fastify is the intended HTTP framework once dependencies are installed.
- Validation: Zod or equivalent contract validation at boundaries.
- Database access: PostgreSQL driver with explicit repositories/transactions; ORM selection remains optional and must not obscure domain ownership or migrations.
- Local infrastructure: PostGIS + Redis through Docker Compose.
- External API: REST + OpenAPI.
- Internal cross-domain integration: versioned domain events + transactional outbox.

## Consequences

- We avoid premature service fragmentation while retaining extraction boundaries.
- Provider SDKs live behind adapters and cannot leak into domain models.
- Redis/search loss cannot destroy Booking/Journey/Finance/Safety truth.
- The repo remains deployable independently of any previous prototype/vendor.

## Framework version snapshot — 2026-08-28

For the initial mobile shell, the repository targets **Expo SDK 57**, which is the current stable Expo SDK and pairs with **React Native 0.86** and React 19.2.3. React Native 0.87 is already stable independently, but DAZAT will not force an unsupported Expo/RN pairing simply to chase the newest minor. Version upgrades remain controlled engineering changes.

The Control Room baseline targets the currently supported Vite 8 line. API package metadata targets the current Fastify 5 line. Lockfiles will be generated only when dependencies are installed in the actual connected development environment.
