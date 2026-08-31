# Engineering Phase 0.23 checklist

## Completed

- [x] Install the committed lockfile with lifecycle scripts disabled.
- [x] Compile Control Room and Organisation Portal production bundles.
- [x] Compile the Fastify API, workers, contracts, domain and design system.
- [x] Fix strict optional-property boundary handling across Booking, Dispatch, Identity, Journey, Driver Support and Driver Appeals.
- [x] Fix communications acknowledgement row-count nullability.
- [x] Fix Journey arrival blocker typing and maintenance projection duplication/completeness.
- [x] Ignore generated TypeScript incremental-build metadata.
- [x] Pass all structural verifiers and all 297 domain tests.
- [x] Make CI build every workspace before running the full source check.

## Still requires a capable runtime

- [ ] Execute migrations 0001–0020 against disposable PostgreSQL/PostGIS.
- [ ] Exercise transaction and concurrency scenarios against the real database.
- [ ] Run Expo applications on devices and execute authenticated end-to-end flows.
- [ ] Run provider integrations only after their separate approvals and controls exist.
