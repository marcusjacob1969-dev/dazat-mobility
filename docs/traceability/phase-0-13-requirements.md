# Phase 0.13 unified communications traceability

| Blueprint §55.1 / P1 requirement | Source implementation | Status |
|---|---|---|
| One governed engine across Booking, Safety, school, payment, Driver, rescue, Support and business | `communications.communication`; `requestInternalCommunication` | SOURCE_TESTED |
| Communication remains separate from delivery attempts | `communication`; `communication_delivery_plan`; `message_delivery` | SOURCE_TESTED |
| In-app, push, SMS, email, voice, masked call, protected chat and portal channels | domain channel model and database constraints | SOURCE_TESTED |
| Purpose governs consent, quiet hours and fallback | `planCommunicationRoute`; preference versions; delivery plans | SOURCE_TESTED |
| Marketing cannot bypass consent by relabelling | domain/database hard-false guards | SOURCE_TESTED |
| Contact verification and scoped recipient role remain explicit | route candidate verification; recipient person/role | SOURCE_TESTED |
| Protected contact does not expose personal numbers | protected conversation/masked call hard-false guards | SOURCE_TESTED |
| Templates are versioned and critical templates require approval | immutable `communication_template_version` | SOURCE_TESTED |
| Security messages never request passwords, full PINs, OTPs or device-linking codes | domain and database hard-false template guards | SOURCE_TESTED |
| Delivery states remain distinct, including UNKNOWN | append-only `message_delivery`; contracts | SOURCE_TESTED |
| Critical communication can require acknowledgement/escalation | acknowledgement aggregate, API and domain decision | SOURCE_TESTED |
| Silent Assistance no-auto-call survives fallback | route planner and delivery-plan database constraint | SOURCE_TESTED |
| Old assignment/Booking/Journey/payment notifications are suppressed | source version currentness and `SUPPRESSED_STALE` | SOURCE_TESTED |
| Channel degradation is explicit and purpose-specific fallback remains planned | current channel-health view and inbox projection | SOURCE_TESTED |
| COM-STA-001 stale/out-of-order suppression | currency guard, persisted version, delivery constraint | SOURCE_TESTED |
| COM-ACK-001 acknowledgement and escalation | acknowledgement domain/API/outbox | SOURCE_TESTED |
| COM-MKT-001 marketing separation | purpose/consent/hard-false guards | SOURCE_TESTED |
| COM-PROV-001 degraded fallback preserving privacy/silent assistance | route planner, protected contact and channel health | SOURCE_TESTED |
| Production provider delivery, approved policies and staffing | hard-disabled pending accountable decisions | NOT_IMPLEMENTED |
