# Phase 0.15 omnichannel operations traceability

| Blueprint §55.3 requirement / invariant | Source implementation | Status |
|---|---|---|
| All channels orchestrate through Communications rather than product modules | CommunicationRequest/policy domain and database authority guards | SOURCE_TESTED |
| Authoritative domains supply events; Communications invents no business state | request hard-false guard and policy decision | SOURCE_TESTED |
| One event can produce role-specific scoped messages | eligible role policy/request truth | SOURCE_TESTED |
| Notification Policy is versioned and reconstructable | guarded `notification_policy_version` | SOURCE_TESTED |
| Policy records class, channels, acknowledgement, retry and escalation | Notification/Delivery Policy persistence | SOURCE_TESTED |
| Critical/security/safeguarding templates stay outside campaign editing | database constraint and policy boundary | SOURCE_TESTED |
| Marketing cannot borrow operational identifiers/consent | domain and database hard-false guards | SOURCE_TESTED |
| Current state is rechecked and stale events are suppressed | request versions, resolution record and domain decision | SOURCE_TESTED |
| Silent Assistance do-not-call survives fallback | resolution hard-true guard and domain route filter | SOURCE_TESTED |
| PAYMENT_STATUS_UNKNOWN never tells payer to retry | domain template blocker and traceable policy | SOURCE_TESTED |
| Breakdown continuity preserves original Booking | domain template blocker and canonical context | SOURCE_TESTED |
| School/safeguarding avoids consumer no-show wording | domain template blocker and controlled-policy class | SOURCE_TESTED |
| ContactCase links to but never replaces canonical cases | database hard-false guard and recipient projection | SOURCE_TESTED |
| P0/P1 case ownership/next action/attention time is mandatory | ContactCase constraints/update guard and domain decision | SOURCE_TESTED |
| Channel switching preserves identity, permission and timeline | interaction/transfer immutable records | SOURCE_TESTED |
| Personal email/SMS workaround is prohibited | interaction/case hard-false guards | SOURCE_TESTED |
| SENT/DELIVERED/READ/ACKNOWLEDGED remain distinct | delivery-assurance decision and SLO facts | SOURCE_TESTED |
| Critical unreachable recipient opens failure case | CommunicationFailureCase and domain decision | SOURCE_TESTED |
| Contactability stays temporary and not a personal rating | failure-case constraints and hard-false constant | SOURCE_TESTED |
| One correlation chain preserves fallback history | request/failure/case correlation fields | SOURCE_TESTED |
| SLO/health distinguish provider acceptance from delivery | SLO and provider-health observations | SOURCE_TESTED |
| Metrics exclude sensitive content by default | SLO/event constraints and domain decision | SOURCE_TESTED |
| Outage failover preserves privacy/consent/templates/audit | profile/response-plan constraints and domain decision | SOURCE_TESTED |
| RECOVERING revalidates and discards stale/duplicate work | response-plan guards and outage decision | SOURCE_TESTED |
| P0/P1 scenarios cover primary/fallback/failure/stale/duplicate/order | scenario constraint and domain acceptance gate | SOURCE_TESTED |
| Simulation never contacts real users/providers | scenario/run hard-false guards | SOURCE_TESTED |
| Provider send/failover, Contact Centre mutation and scenario execution | disabled pending accountable decisions | NOT_IMPLEMENTED |
