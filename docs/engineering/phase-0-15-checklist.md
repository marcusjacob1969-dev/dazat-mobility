# Engineering Phase 0.15 checklist

## Source foundation completed

- [x] Model versioned Notification Policy by authoritative event, role, purpose, class and region/legal variant.
- [x] Separate CommunicationRequest from canonical domain state and prohibit UI guesses/business-state invention.
- [x] Revalidate source versions and suppress stale assignment, Journey and payment messages.
- [x] Preserve role-specific content for booker, passenger, payer, guardian, Driver and organisation contacts.
- [x] Keep controlled critical/security/safeguarding policy outside campaign-user editing.
- [x] Preserve marketing consent and operational/campaign identifier separation.
- [x] Guard Silent Assistance, PAYMENT_STATUS_UNKNOWN, breakdown continuity and school wording across policy/fallback.
- [x] Model versioned Delivery Policy, real acknowledgement dependency and critical failure escalation.
- [x] Distinguish provider acceptance, SENT, DELIVERED, READ and ACKNOWLEDGED.
- [x] Add shared Contact Case without replacing canonical Booking/Journey/Safety/Finance/Fleet cases.
- [x] Require P0/P1 owner, next action, attention time and receiving owner across transfer.
- [x] Preserve cross-channel identity/permission/interaction history and prohibit personal-tool workarounds.
- [x] Keep contactability temporary/contextual and prohibit long-term personal rating use.
- [x] Model provider/channel/region health, approved failover and RECOVERING revalidation.
- [x] Add privacy-safe Communication SLO evidence without broad message-content surveillance.
- [x] Add provider-disabled scenario catalogue/run/result truth with P0/P1 failure and ordering cases.
- [x] Add public disabled capabilities plus authenticated recipient-owned cases/assurance status.
- [x] Add Rider, Driver and Control Room truth surfaces.
- [x] Add OpenAPI, ADR, traceability, structural verifier and executable source-domain tests.

## Deliberately not claimed

- [ ] Execute migration 0015 against PostgreSQL/PostGIS with policy, case-transfer, outage and concurrency tests.
- [ ] Compile and run Fastify, Expo and Vite workspaces with installed dependencies.
- [ ] Approve or seed production Notification/Delivery Policies, templates, regional/legal variants or SLO targets.
- [ ] Select/configure primary or secondary communications/Contact Centre providers.
- [ ] Approve Contact Centre roles, permissions, separation of duties, queues, staffing, handover or service levels.
- [ ] Implement provider webhooks, external sending, retry/failover execution or outage detection.
- [ ] Enable Contact Centre case mutations, follow-up sends or scenario execution.
- [ ] Run scenarios against production data or real users.
- [ ] Approve message/transcript/recording/log retention, evidence holds or bulk-export controls.
- [ ] Complete accessibility, translation, lock-screen minimisation and critical-template assurance.

## Stop conditions retained

- No external message, call, provider failover, callback, emergency contact or scenario delivery.
- No staff mutation or personal email/SMS workaround.
- No policy resolution without an authoritative event/current-state revalidation.
- No stale or duplicate replay after outage recovery.
- No critical delivery failure left only in a provider log or P0/P1 case left unowned.
- No provider-acceptance-as-delivery claim, contactability rating or sensitive-content dashboard.
- No destructive deletion of policy, request, case, interaction, failure, acknowledgement, health, SLO or scenario history.
