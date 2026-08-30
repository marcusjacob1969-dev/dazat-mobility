# Engineering Phase 0.13 checklist

## Source foundation completed

- [x] Add one purpose-aware Communication aggregate shared across product domains.
- [x] Separate Communication intent from append-only MessageDelivery attempts.
- [x] Persist immutable, approved, versioned template truth with security-secret guards.
- [x] Persist versioned per-purpose preferences, channel blocks, quiet-hours fields and separate marketing consent.
- [x] Scope each communication to a recipient person and role without copying personal contact details.
- [x] Add safe ordered channel planning with verified-contact, permission, health and compromised-channel gates.
- [x] Preserve Silent Assistance no-auto-call behaviour through fallback planning.
- [x] Revalidate source aggregate versions and suppress stale communication before delivery.
- [x] Model QUEUED, SENT, DELIVERED, READ, FAILED, EXPIRED, UNKNOWN and SUPPRESSED_STALE distinctly.
- [x] Add explicit critical acknowledgement and human-escalation decisions.
- [x] Add time-bounded protected-conversation and masked-call truth without personal-number disclosure.
- [x] Add explicit channel-health/degraded-mode projection.
- [x] Add authenticated recipient inbox/detail/idempotent acknowledgement APIs.
- [x] Add Rider, Driver and Control Room communication boundary surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verification and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0013 against production-like PostgreSQL with concurrent acknowledgement and stale-suppression tests.
- [ ] Compile and run Fastify, Expo and Vite workspaces with installed dependencies.
- [ ] Select, contract or configure push, SMS, email, telephony, masked-call, chat or portal providers.
- [ ] Approve production templates, translations, fallback policies, quiet-hours timezone rules or retention schedules.
- [ ] Deliver a queued communication or consume provider callbacks/webhooks.
- [ ] Configure operational acknowledgement escalation staffing or external Safety procedures.
- [ ] Implement telephone booking, caller identity assessment, Voice Assistant or human call handoff (§55.2).
- [ ] Implement protected-chat content/evidence access, abuse controls or lost-property case workflows.

## Stop conditions retained

- No provider call, message send, telephone call, external contact or procurement commitment.
- No `SENT`, `DELIVERED` or `READ` claim without an append-only provider observation.
- No stale source delivery, blind retry of `UNKNOWN`, marketing-consent bypass or unsafe Silent Assistance fallback.
- No direct personal contact detail exposure.
- No deployment, credential change or destructive deletion of communication, delivery or acknowledgement history.
