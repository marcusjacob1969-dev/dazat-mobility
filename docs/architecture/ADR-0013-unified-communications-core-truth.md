# ADR-0013: Unified Communications Core truth

- Status: Accepted for Engineering Phase 0.13 source foundation
- Date: 2026-08-30
- Blueprint sources: §55.1 and §70 Communications P1 requirements

## Context

Booking, Journey, Safety, school safeguarding, payments, account security, Driver operations, Support, business and marketing all need communication. Implementing each as a direct provider call would fragment consent, recipient scope, fallback, delivery truth, privacy, acknowledgement and degraded-mode handling.

Communication intent is not the same fact as a channel delivery attempt. `SENT`, `DELIVERED`, `READ`, `FAILED`, `EXPIRED` and `UNKNOWN` cannot be inferred from a queued request. A notification built from an old Booking, assignment, Journey or payment version can be actively harmful after reassignment or state change.

No production push, SMS, email, telephony or protected-chat provider, template approval authority, fallback policy, retention schedule or operational escalation service is approved in this checkpoint.

## Decision

1. All product domains request a purpose-scoped `Communication`; they do not call external providers directly.
2. Purpose is explicit and controls consent, quiet hours, safe channels, fallback and future retention. Marketing consent remains separate, and marketing can never be relabelled as operational.
3. Recipient person and recipient role are explicit. Third-party booking never grants unrestricted financial, Safety or location disclosure.
4. `CommunicationTemplateVersion` is immutable. Critical templates require accountable approval, and account-security templates are constrained against asking for passwords, full PINs, OTPs or device-linking codes.
5. `CommunicationDeliveryPlan` records an ordered safe route and fallback requirement separately from `MessageDelivery` attempts.
6. External provider execution is hard-disabled in Phase 0.13. No queued plan is described as sent or delivered.
7. Delivery observations are append-only and retain `UNKNOWN`. A future adapter must revalidate the source aggregate version before every attempt; stale messages become `SUPPRESSED_STALE`.
8. Critical communications may require an explicit acknowledgement deadline. Failure, `UNKNOWN`, expiry or a missed deadline requires human escalation; it is not silently converted into acknowledgement.
9. Channel health is explicit as `HEALTHY`, `DEGRADED`, `UNAVAILABLE` or `UNKNOWN`. Missing/expired evidence is `UNKNOWN`.
10. Silent Assistance excludes voice/auto-call fallback. Compromised and unverified channels are excluded from sensitive routing.
11. Protected conversations and masked calls are time-bounded and linked to a legitimate Journey/case window. Personal contact details are never exposed.
12. Authenticated recipients may read only their own communication inbox/detail and submit idempotent acknowledgements. No public send, staff retry or provider-state editor is exposed.

## Consequences

- Domain services can later depend on one governed request interface while providers remain replaceable adapters.
- A missing template, unsafe route, missing marketing consent, expired message or stale source is an explicit suppression reason.
- Provider integration will require a revalidating worker, signed callbacks, deduplication, retry policy and production-like failure/concurrency tests.
- Caller identity, telephone booking and Voice Assistant orchestration remain the next §55.2 package, not an implied capability of this core.

## Rejected alternatives

- Direct SMS/email/push calls from Booking, Safety, Finance or Driver services.
- Treating a provider timeout or queued job as delivery.
- Marketing relabelling to bypass consent or quiet hours.
- Sending stale assignment, pickup, payment or Journey information.
- Exposing personal telephone/email details to enable direct contact.
- Automatic voice fallback during Silent Assistance.
