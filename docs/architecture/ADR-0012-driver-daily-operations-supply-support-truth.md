# ADR-0012: Driver daily operations, supply and support truth

- Status: Accepted for Engineering Phase 0.12 source foundation
- Date: 2026-08-30
- Blueprint sources: §45, §54.5, §66 P1 Driver/Dispatch requirements

## Context

The Driver product needs one coherent daily lifecycle without collapsing distinct facts into a convenient screen state. Secure session, selected vehicle, operating eligibility, scheduled commitments, work intent, offers, assignment, Journey, earnings, support and connectivity have different owners and different safety consequences.

Phase 0.11 established that ordinary declines, breaks and temporary restrictions must not silently become misconduct or hidden Dispatch punishment. Phase 0.12 must preserve those rules while making daily work usable under weak signal and operational pressure.

Real Driver earning policy, route-time estimation, communications providers, navigation integrations and operational staffing are not approved in this checkpoint. Source must fail closed instead of inventing them.

## Decision

1. The daily lifecycle is explicit from secure session through end shift. Driver availability remains the work-intent authority; approval and eligibility remain separate.
2. `BREAK` and `FINISHING_SOON` are normal, non-punitive states. `OFFLINE` clears ordinary app location; separately governed Fleet telematics is not silently treated as Driver-app tracking.
3. Shift boundaries and work-intent changes retain append-only evidence linked to authoritative availability versions.
4. Scheduled-work commitments are evidence-backed accepted commitments with an explicit protected window. Dispatch checks them before offering conflicting work.
5. Every Driver offer has an immutable disclosure record. Pickup distance, pickup ETA, service context and an independent Driver-earning estimate must be complete before acceptance. The Rider fare cannot be reused as the Driver earning.
6. Until route ETA and Finance-approved Driver earning policy exist, offers are visible as incomplete but acceptance fails closed. Decline remains non-punitive.
7. Weak-signal reconciliation returns authoritative availability/Journey versions. It never marks queued SOS, silent assistance, conduct, location or communication events as executed; clients must submit each through its canonical idempotent command.
8. Arrival communication uses the chosen Booking pickup, not assumed passenger GPS. Recipients and channels are scoped; direct personal contact details are not exposed to the Driver projection.
9. Current demand observations and forecasts remain distinct, evidence-backed and capability-aware. Neither is an earnings guarantee.
10. Homeward preference may influence ranking only after hard eligibility, cannot use passenger attributes and never guarantees a trip.
11. Driver Support has typed Safety, breakdown, payment, account, compliance, technical, passenger and Fleet cases. High-risk active cases require human escalation. This foundation contacts no external service.
12. Voice readout, CarPlay and Android Auto remain explicit unconfigured roadmaps. Voice input never bypasses backend validation.

## Consequences

- Honest missing disclosures can temporarily block offer acceptance. This is safer than a deliberately blind commercial offer.
- Existing Dispatch, Journey completion and protected unsafe-termination paths now append daily shift evidence.
- Provider, staffing and commercial decisions can be added behind these boundaries without changing canonical Driver work truth.
- Database/concurrency, app compilation and real-device weak-signal behaviour still require a production-like environment.

## Rejected alternatives

- Deriving Driver earnings from the Rider fare.
- Treating BREAK, FINISHING_SOON, decline or weak signal as poor conduct.
- Automatically replaying queued critical commands during a status-only reconciliation.
- Mixing forecast and current demand or implying guaranteed income.
- Assuming passenger GPS is the pickup point.
- Allowing support UI or voice input to bypass Safety, eligibility, Journey or Finance commands.
