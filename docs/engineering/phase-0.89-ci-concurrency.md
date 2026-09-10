# Engineering Phase 0.89 — Bounded Hosted CI Concurrency

Hosted verification now groups runs by workflow and Git reference and cancels an older in-progress run when a newer commit supersedes it.

Separate branches and pull requests retain independent verification. The workflow continues to use read-only repository permissions, exact action revisions, explicit timeouts and the complete container, dependency, compilation, runtime and PostGIS gates.

This prevents stale commits from occupying hosted runners after rapid updates without weakening the evidence required for the latest commit.
