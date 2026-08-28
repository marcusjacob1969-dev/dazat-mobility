# DAZAT Mobility — Production Engineering

This repository is the clean production build started from the **DAZAT Mobility Master Blueprint v0.4** after the PRE-WORK COMPLETE milestone.

## Current engineering phase

**Phase 0 — Production Foundation / checkpoint 0.1**

This checkpoint deliberately starts with the platform spine instead of polishing screens first:

- owned monorepo and domain boundaries;
- PostgreSQL/PostGIS authoritative data foundation;
- Redis only as derived/ephemeral infrastructure;
- transactional-outbox foundation;
- canonical identity/profile separation;
- canonical Booking status vocabulary;
- shared contracts and design tokens;
- Rider, Driver and Control Room application shells;
- Node.js + TypeScript API/worker service shells;
- OpenAPI baseline;
- local infrastructure definition;
- offline structural verification and domain tests.

## Governing engineering rules

1. One business fact has one authoritative owning domain.
2. Clients request commands; they do not set authoritative state.
3. PostgreSQL/PostGIS owns transactional truth. Redis/search/analytics are rebuildable derived state.
4. Cross-domain writes go through domain commands/events, not repository/table shortcuts.
5. Authoritative change + outbox event commit atomically.
6. No database transaction waits on an external provider.
7. Provider results may be `UNKNOWN`; the platform must not manufacture certainty.
8. The Rider, Driver, Control Room, telephone, voice and institutional channels share the same canonical backend engines.
9. The build is private/owned DAZAT software. No competitor UI/code cloning.
10. Blueprint requirement → implementation → test → evidence remains traceable.

## Local foundation check

This checkpoint can be verified without downloading third-party packages:

```bash
npm run check
```

The mobile/web/API application packages declare their intended dependencies but package installation is intentionally not required for the foundation verifier in this archive.

## Local infrastructure

When Docker is available:

```bash
docker compose up -d postgres redis
```

This starts local PostGIS and Redis services. The credentials in `compose.yaml` are local-development defaults only.

## Next engineering slice

The next slice is **Identity + Account Foundation**, followed by the first canonical Booking flow:

`Create identity/account → Rider profile → create Booking → quote → confirm → READY_FOR_DISPATCH`.

No live payments, real dispatch or customer data should be introduced before the relevant security/provider gates are implemented.
