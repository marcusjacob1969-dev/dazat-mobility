# ADR-0015: Omnichannel policy, Contact Centre and communications-observability truth

- Status: Accepted for Engineering Phase 0.15 source foundation
- Date: 2026-08-30
- Blueprint source: §55.3

## Context

DAZAT already has one Communications Core and a provider-disabled telephone/voice foundation. It still needs a governed catalogue that maps authoritative events to role-scoped communication, a shared human-service case across channels, explicit critical-delivery failure work, provider-health/failover truth, privacy-safe service-level evidence and isolated acceptance scenarios.

Without these boundaries, individual modules could send inconsistent messages, stale assignment or payment claims could escape, a failed critical alert could disappear into a provider log, channel switching could lose identity/permission context, and broad dashboards could become message-content surveillance.

No communications provider, Contact Centre platform, operator permission model, approved production policy catalogue, service-level target, regional wording/retention variant, staffing plan or isolated scenario runner is configured in this checkpoint.

## Decision

1. `NotificationPolicyVersion` maps an authoritative event type to purpose, classification, eligible recipient roles, controlled content, primary/fallback channels, acknowledgement, retry, escalation, regional/legal and retention rules.
2. `CommunicationRequest` carries authoritative event and aggregate versions, recipient role/person, urgency, sensitivity, language/accessibility needs and deadline. It cannot invent business state or relabel marketing.
3. Policy resolution revalidates current aggregate state. Stale events are suppressed; role eligibility, quiet-hour overrides, Silent Assistance, marketing consent and regional/legal policy remain explicit.
4. Booker, passenger, payer, guardian, Driver and organisation messages may differ intentionally. Financial, Safety, location, school and Driver facts remain scoped to their canonical owners.
5. `DeliveryPolicyVersion`, `CriticalAcknowledgementRequirement` and `CommunicationFailureCase` distinguish SENT, DELIVERED, READ and ACKNOWLEDGED. A critical unreachable recipient creates owned operational work instead of repeated channel hammering.
6. `ContactCase` is the cross-channel human-service container. It preserves owner, priority, next action, attention time, contactability, identity/permission state and interaction history while linking to—never replacing—Booking/Journey/Safety/Finance/Fleet cases.
7. P0/P1 Contact and delivery-failure cases cannot remain unowned. A transfer requires a receiving owner and preserves critical context, pending acknowledgements and degraded-channel workarounds.
8. Personal email/SMS tools and copied personal contact data are prohibited as casework workarounds.
9. `ChannelProviderHealthObservation` distinguishes HEALTHY, DEGRADED, PARTIAL_OUTAGE, OUTAGE, RECOVERING and UNKNOWN. Provider acceptance never proves delivery.
10. Failover must preserve consent, privacy, templates, audit and Silent Assistance. Marketing/routine traffic is delayed by default; critical traffic uses only approved alternates or human contingency.
11. RECOVERING holds queued work for current-state revalidation and discards stale items, preventing replay storms.
12. `CommunicationSLOObservation` measures operational latency by channel/region/purpose without sensitive message content or unrestricted case drilldown.
13. Contactability is temporary contextual state, never a long-term person or Driver rating.
14. Provider-disabled `CommunicationsScenario` runs require approved fixtures, P0/P1 success/failure/fallback/stale/duplicate/out-of-order cases, template safety and accessibility coverage, and never contact real users.
15. Only provider-disabled capabilities, recipient-owned Contact Cases and recipient-scoped assurance status are exposed. No staff mutation, provider send, failover or scenario-run endpoint exists.

## Consequences

- Communications operations can be tested as policy and evidence before any vendor is enabled.
- Critical delivery failure becomes visible owned work with one correlation chain across channels.
- Operational health can be measured without weakening role boundaries or exposing message content broadly.
- Production readiness still requires approved policies/templates, staff roles, providers, SLOs, retention, regional/legal variants, accessibility/language validation and outage drills.

## Rejected alternatives

- Letting Booking, Journey, Finance or app clients send directly around Communications policy.
- Treating provider acceptance, SENT or a repeated attempt as delivery success.
- Closing a critical workflow inside a provider log without an owned failure case.
- Making ContactCase a second Safety, Booking, Finance or Fleet database.
- Treating temporary contactability as a quality or personal score.
- Failing over to an unapproved provider without the original privacy/consent/template controls.
- Releasing outage backlog blindly or running acceptance scenarios against real users.
