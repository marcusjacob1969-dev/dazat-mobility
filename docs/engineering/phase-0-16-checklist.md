# Engineering Phase 0.16 checklist

## Source foundation completed

- [x] Define Communications ownership without absorbing Booking, Journey, Safety, School, Finance, Driver, Fleet, Support or Shield truth.
- [x] Model a versioned canonical event envelope with immutable event ID, aggregate version, occurrence/recording time, region/service context, classification, correlation, causation and schema version.
- [x] Deduplicate immutable events and fail closed on unsupported critical schemas.
- [x] Record all fourteen named P0/P1 event types as a versioned closure catalogue.
- [x] Record all fifteen conceptual API operations without exposing unapproved mutations.
- [x] Record all twenty Communications P0 requirement IDs separately from production verification.
- [x] Model the canonical CommunicationRequest contract with idempotency, source event, role, approved payload variables, state version, classification, acknowledgement and fallback policy.
- [x] Prohibit raw contact injection, arbitrary source-object dumps and business-state invention.
- [x] Enforce recipient-role permission and minimum-necessary payload before channel selection.
- [x] Keep passenger, booker, payer, guardian/carer, school, Driver, organisation, Control Room, Safety and partner/rescue scopes separate.
- [x] Prohibit priority from granting additional data access and require an active task for operator scope.
- [x] Implement the ten-step channel/fallback decision order with stale suppression and attempt caps.
- [x] Preserve provider acceptance, SENT, DELIVERED, READ and ACKNOWLEDGED as distinct facts.
- [x] Open owned critical failure work rather than hammering a failed channel.
- [x] Model explicit outage/recovery and Shield-degraded decisions that discard stale/duplicate work and pause risky changes.
- [x] Preserve essential canonical Journey, Safety and safeguarding work during Shield degradation.
- [x] Model all eighteen final-closure acceptance scenarios as fixture-only, provider-disabled evidence.
- [x] Model all thirteen launch gates separately from policy, provider, staffing and privacy approvals.
- [x] Add public disabled capabilities plus authenticated recipient status and launch-evidence reads.
- [x] Add Rider, Driver and Control Room final-closure truth surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verifier and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0016 against PostgreSQL/PostGIS and exercise uniqueness, immutability, permission, route and evidence constraints.
- [ ] Compile and run Fastify, Expo and Vite workspaces with installed workspace dependencies.
- [ ] Implement or expose conceptual Communications mutation endpoints.
- [ ] Approve or seed production Notification/Fallback Policies, templates, translations, retention variants or SLOs.
- [ ] Select, contract, configure or call a push, SMS, email, telephony, protected-chat, masked-call or portal provider.
- [ ] Approve Control Room/Safety roles, JIT/break-glass authority, exports, staffing, queues or service levels.
- [ ] Execute provider callbacks, retry/failover, outage detection, recovery replay or message sending.
- [ ] Execute acceptance scenarios against production data, external providers or real people.
- [ ] Pass any production launch gate or claim pilot readiness.
- [ ] Complete legal, privacy/retention, security, accessibility, safeguarding, procurement and operations approval.

## Stop conditions retained

- No provider call outside the governed engine and no client authority merely because an endpoint exists.
- No request without immutable source event, idempotency, recipient permission, approved variables and current-state validation.
- No role leakage, arbitrary source-object payload, raw contact injection or priority-based access expansion.
- No stale or duplicate operational delivery, recovery replay or fallback.
- No provider-acceptance-as-delivery claim or silent critical failure.
- No caller-ID, transcript, contact verification or one-channel possession used as universal high-risk authority.
- No high-risk account or financial change fails open when Shield is unavailable.
- No acceptance or launch evidence created through real-user contact or external provider execution.
- No destructive deletion of closure envelope, request, permission, route, degraded-mode, acceptance or launch evidence.
