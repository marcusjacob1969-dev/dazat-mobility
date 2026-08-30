# Engineering Phase 0.14 checklist

## Source foundation completed

- [x] Model provider-disabled inbound/outbound CallSession, purpose, queue, quality and canonical links.
- [x] Hash/hint presented numbers and prohibit personal-number exposure.
- [x] Separate caller claim, caller-ID hint, independent verification, confidence, step-up and restrictions.
- [x] Fail closed on high-risk voice actions without independent step-up.
- [x] Add versioned Contact Plan for landline/basic-mobile/intermediary/accessibility communication.
- [x] Add guarded Voice Dialogue state and field-level source/confidence/readback/confirmation.
- [x] Require all critical telephone Booking fields, party separation, quote and capacity confirmation.
- [x] Constrain telephone Booking to the canonical Booking Engine and idempotent linkage.
- [x] Add purpose/risk queues, mandatory warm-handoff context and callback restrictions.
- [x] Add secure provider-disabled payment handoff with raw-card and blind-retry hard-false guards.
- [x] Add SafetyAttentionSignal without automatic danger/misconduct finding or emergency-service claim.
- [x] Separate recording, transcript, correction and interpreter truth with restricted-use guards.
- [x] Preserve dropped-call pending state and prohibit duplicate Booking creation.
- [x] Keep voice biometrics future-only and prohibit sole high-risk authority.
- [x] Add public provider-disabled capabilities plus authenticated Contact Plan/interaction reads.
- [x] Add Rider, Driver and Control Room truth surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verification and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0014 against PostgreSQL/PostGIS and test concurrent call/drop/resume/Booking commands.
- [ ] Compile and run Fastify, Expo and Vite workspaces with installed dependencies.
- [ ] Select or configure telephony, Voice Assistant, contact-centre, recording, transcription, interpreter or PCI IVR providers.
- [ ] Implement inbound webhook signature verification, media/signalling, speech recognition or call routing.
- [ ] Approve operator roles, scripts, queues, staffing, callback service levels or warm-handoff procedures.
- [ ] Approve regional recording/transcription notices, legal bases, retention or evidence access.
- [ ] Approve emergency guidance, interpreter coverage, critical translations or covert/discreet telephone safety phrases.
- [ ] Expose telephone Booking creation, existing-Booking change, cancellation or payment commands.
- [ ] Implement or claim voice biometrics.

## Stop conditions retained

- No external call, callback, message, provider event, payment collection or emergency-service contact.
- No caller-ID, voice, transcript, payment or intermediary authority shortcut.
- No critical Booking commitment without structured confirmed readback and canonical backend validation.
- No raw card data, voice biometric enrolment, casual recording reuse or original transcript rewriting.
- No deployment, credential change or destructive deletion of call, identity, field, transfer, Safety or payment history.
