# Phase 0.146 — Repair Phase 0.141 verifier encoding

The Core Journey PostgreSQL verifier contained literal backslash-n sequences in the Phase 0.141 source block. This phase restores those sequences to real line breaks so the JavaScript is executable and the aggregate verification chain remains trustworthy.

No product behaviour changes.
