# ADR-0014: Telephone, Voice Assistant and human-handoff truth

- Status: Accepted for Engineering Phase 0.14 source foundation
- Date: 2026-08-30
- Blueprint sources: §55.2 and OPS-TEL-001

## Context

A person who cannot use an app must eventually be able to use DAZAT through telephone and assisted communication without receiving a reduced-function or less safe service. Telephone is also a high-risk channel: caller ID can be spoofed, phones are shared, speech recognition is uncertain, intermediaries have limited authority, calls drop and operators can be targeted through social engineering.

Telephone cannot become a second Booking/Dispatch/Payment database or an authority shortcut. Voice recognition, transcripts, payment completion and caller ID are observations, not proof of identity or business state.

No telephony, Voice Assistant, recording, transcription, interpreter, PCI IVR or contact-centre provider, operator permission model, regional emergency procedure or approved script catalogue exists in this checkpoint.

## Decision

1. `CallSession` records inbound/outbound direction, routed-service reference, purpose, queue, language, quality, linked canonical context and handoff state without storing or exposing a raw personal number.
2. Caller ID is a routing hint only. `CallerIdentityAssessment` records claimed role, requested action, independent verification methods, confidence, step-up and scoped restrictions.
3. Account recovery, payout/bank changes, stored-payment changes and sensitive profile access fail closed without independent step-up and may remain prohibited over voice.
4. `ContactPlanVersion` supports no-smartphone/basic-mobile/landline, arrival, intermediary, language and accessibility-communication needs without storing diagnoses or granting unlimited access.
5. Voice Assistant is an input/orchestration layer. Its state proceeds through intent, required fields, readback, confirmation, backend command and result; it never overrides canonical backend rules.
6. Pickup, destination, date/time, passenger identity, accessibility requirements and final price require structured provenance/confidence plus explicit readback and confirmation. Repeated failure triggers human handoff.
7. `TelephoneBookingSession` can link to a Booking only after complete confirmation and only through the canonical Booking Engine. Booker, passenger and payer remain separate.
8. Human handoff is warm and purpose/risk routed. It preserves caller claim/verification, confirmed fields, canonical case context and the unresolved question. Safety and safeguarding are not deferred to an ordinary callback.
9. Operator/general voice never captures full card details. Only a secure link, tokenised saved method or PCI-compliant route may later be enabled. `STATUS_UNKNOWN` forbids blind repeat collection, and payment never expands caller identity authority.
10. Safety phrase classification creates a human-assessed signal, not proof of danger or misconduct. DAZAT does not claim to replace emergency services.
11. Recording, transcript, correction and interpreter sessions are separate governed objects. Transcripts never replace confirmed structured fields; original history is not rewritten; unrelated model training is prohibited by default.
12. Dropped calls preserve confirmed pending state and idempotency so reconnect/callback cannot duplicate a Booking, cancellation or payment.
13. Voice biometrics are not a baseline capability and can never be the sole authority for high-risk changes.
14. Only provider-disabled capability, Contact Plan and recipient-owned interaction-history reads are exposed. No public start-call, operator mutation or Voice Assistant endpoint exists.

## Consequences

- The source can support equitable telephone access later without inventing provider availability now.
- Operators will need a separate permission/separation-of-duty package before canonical commands can be exposed.
- Production readiness requires telephony/PCI/provider contracts, accessibility and language validation, recording law, retention, emergency procedures, abuse controls and failure/concurrency testing.
- Omnichannel policy catalogue, contact-centre casework and communications observability remain the next §55.3 package.

## Rejected alternatives

- Treating matching caller ID, voice characteristics or payment success as identity proof.
- Allowing speech confidence or transcripts to silently fill critical booking fields.
- Creating a parallel telephone-only Booking or pricing system.
- Letting the general voice model or operator receive full card details.
- Cold handoff that discards confirmed context and makes the caller repeat everything.
- Retrying payment or booking creation after uncertainty without reconciliation/idempotency.
- Claiming covert voice safety, recording, transcription or voice biometrics without approved implementation.
