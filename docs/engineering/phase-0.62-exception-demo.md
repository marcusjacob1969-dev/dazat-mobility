# Engineering Phase 0.62 — Exception-aware journey demo

The reproducible `npm run demo:core-journey` command now compiles and exercises the same API progress projector used by Rider and Driver clients. Its deterministic output includes an active-incident journey and proves that the journey is marked `SUPPORT_REQUIRED`, with unfinished journey work blocked.

The earlier happy path, fatigue, RideCheck and completion-hold scenarios remain intact. The demonstration stays provider-disabled and performs no production writes, calls, messages or charges.
