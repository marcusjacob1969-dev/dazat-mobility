# Control Room application shell

The Control Room will consume authorised API/read models. It must never become an alternate database editor or a second source of Booking, Safety, Finance, Driver or Shield truth.

Phase 0.6 adds read-only Journey health, connectivity confidence, route concern and completion/handover expectations without copying raw restricted Safety facts. Staff role grants, Safety response, hold release and authorised handover commands are not implemented, so no internal mutation endpoint is exposed here.

Phase 0.7 documents the Finance projection boundary: no direct balance edits, no blind retry of `STATUS_UNKNOWN`, and no collapsing PaymentIntent, Payment, DriverEarning or Payout into one state.

Phase 0.8 documents the Driver authority boundary. Application progress, document extraction, authorised review, assessed competency, scoped service permission, selected-vehicle eligibility, restrictions and availability are separate truths. No staff mutation route is exposed until role, separation-of-duty, evidence and appeal rules exist.

Phase 0.9 documents Fleet supplier/terms/capability/insurance/agreement/handover/deposit/assignment boundaries. No staff mutation route can publish an offer, invent a discount, accept an agreement, apply a deposit deduction or assign a vehicle.

Phase 0.10 documents maintenance-plan, defect, restriction, recall, warranty-first repair, inspection, return-to-service, reliability, replacement and verified-perk boundaries. No staff mutation route can diagnose a defect, override a restriction, approve repair, return a vehicle to service, assign a replacement or publish an unverified benefit.

Phase 0.11 documents fair-treatment separation: ratings are feedback, allegations are not findings, ordinary declines are non-punitive, temporary restrictions are not guilt, and high-impact outcomes retain independent appeal. RiderConductCase remains Safety-owned. No staff mutation route is exposed until reviewer authority, separation of duties, evidence access and audit controls are implemented.

Phase 0.12 documents complete Driver daily-state separation, informed-offer fail-closed behaviour, scheduled-work protection, weak-signal reconciliation, scoped arrival communication, capability-aware current/forecast supply and typed Driver Support. Control Room cannot invent earning/ETA disclosure, mark queued commands executed, promise heatmap earnings, expose direct contacts or bypass mandatory human escalation.

Phase 0.13 documents the unified Communications Core boundary. Communication intent is separate from delivery attempts; purpose governs consent, quiet hours, fallback and retention; stale notifications are suppressed; UNKNOWN is not delivery; critical acknowledgements can require human escalation; and protected contact never exposes personal numbers. No staff send/retry/provider editor is exposed.

Phase 0.14 documents telephone/voice as a provider-disabled route into the same canonical engines. Caller ID is not authentication, confirmed structured fields outrank transcripts, high-risk/low-confidence cases require warm handoff, full card details stay outside operator/general voice, and dropped calls remain idempotent. No operator call-control, Voice Assistant or provider mutation route is exposed.

Phase 0.15 documents the versioned Notification/Delivery Policy, Contact Case, failure escalation, channel health, SLO and isolated scenario boundaries. High-risk cases require ownership, channel switching preserves the timeline, provider acceptance is not receipt, metrics exclude sensitive content and recovery revalidates stale work. No staff editor or provider execution route is exposed.
