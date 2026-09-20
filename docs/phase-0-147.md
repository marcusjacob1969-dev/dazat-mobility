# Phase 0.147 — Aggregate checkpoint verifier chain

Phase 0.147 repairs the aggregate checkpoint verifier after Phase 0.146.

## Change

`scripts/verify-current.mjs` now executes checkpoint verifiers through Phase 0.146 instead of stopping at Phase 0.144.

Phase 0.145 and Phase 0.147 source verifiers assert the updated boundary so the aggregate chain cannot silently omit the latest checkpoint.

## Verification

The repository contains executable checkpoint verifiers for Phases 0.145 and 0.146, and the aggregate verifier now includes both.

This phase changes verification coverage only. It does not introduce provider charging, real-money behaviour, or new operational mutation paths.
