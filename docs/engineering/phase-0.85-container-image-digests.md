# Engineering Phase 0.85 — Verified Container Base-Image Digests

The API build/runtime stages and both hosted PostGIS uses now reference immutable SHA-256 image manifests. The selected digests are the manifests exercised successfully by the Phase 0.84 hosted container, migration, readiness and graceful-shutdown gates.

Human-readable Node 24 Bookworm Slim and PostGIS 16-3.4 tags remain alongside each digest. Updating either dependency therefore requires an explicit source change followed by the complete hosted verification suite.

Digest pinning controls tag drift; it does not replace vulnerability monitoring, patch review, SBOM generation or registry provenance controls.
