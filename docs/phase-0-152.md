# Phase 0.152 — Dynamic checkpoint discovery

The aggregate verifier now discovers `verify-phase-0-N.mjs` checkpoints from the scripts directory instead of maintaining a hard-coded upper phase bound.

It preserves the Phase 0.25 starting boundary and fails closed if any checkpoint number is missing in the contiguous sequence. New checkpoint verifiers are automatically included in `verify:current` without another aggregate-boundary edit.

This is a verification-system improvement only. It does not enable provider charging, capture, refund, or real-money behaviour.
