# Engineering Phase 0.98 — vertical-slice failure proofs

## Purpose

Turn the existing provider-disabled core-journey demonstration into an explicit executable safety catalogue for the demonstrable Rider → Driver → Journey → completion path.

## Verified failure boundaries

The fixture covers:

- ineligible Driver compliance
- fatigue safety block
- stale pickup location evidence
- failed RideCheck
- active completion hold
- rejected destination evidence

The happy path remains executable alongside those failures.

## Safety posture

A blocked scenario stops the canonical journey rather than inventing progress. The demo asserts that no scenario attempts real payment or contacts an external provider. Production charging and provider execution therefore remain disabled.

This phase is test evidence, not production launch approval. Real maps, dispatch providers, payment providers, telephony, communications providers, and pilot operations remain separately governed.
