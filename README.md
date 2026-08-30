# DAZAT Mobility

Production engineering source created from the DAZAT Mobility Master Blueprint v0.4.

Current checkpoint: **Engineering Phase 0.17**.

The server-authoritative vertical slice now reaches governed Journey completion:

`REGISTER → VERIFY → SESSION → BOOKING → QUOTE → CONFIRM → HARD-FILTERED DISPATCH → ATOMIC ASSIGNMENT → EVIDENCED PICKUP → RIDECHECK → PROTECTED START → LIVE JOURNEY → ARRIVING → GOVERNED COMPLETION`

Phase 0.7 extends the completed vertical slice into a provider-disabled Finance foundation:

`GOVERNED COMPLETION → PREPARE PAYMENT INTENT (NO CHARGE) → CANONICAL STATUS / RECEIPT NOT READY`

Phase 0.8 adds the evidence and authority boundary required before Driver operations:

`APPLICATION START → VERIFIED CONTACT RECOGNISED → IDENTITY / DOCUMENT / TRAINING / VEHICLE EVIDENCE → AUTHORISED REVIEW → SCOPED PERMISSION → DERIVED OPERATING ELIGIBILITY`

Phase 0.9 adds evidence-backed Fleet access and assignment truth:

`VERIFIED SUPPLIER TERMS → VERSIONED MARKETPLACE OFFER → VERSIONED AGREEMENT → HANDOVER EVIDENCE → PAIR INSURANCE → FRESH VEHICLE ASSIGNMENT VALIDATION`

Phase 0.10 adds maintenance, defect and vehicle-reliability truth:

`CURRENT MAINTENANCE PLAN → PRE-SHIFT OBSERVATION → DEFECT / RESTRICTION → WARRANTY-FIRST REPAIR → INSPECTION → REVIEWED RETURN TO SERVICE`

Phase 0.11 adds Driver performance and fair-treatment truth:

`SEPARATE EVIDENCE DIMENSIONS → DRIVER RESPONSE → ASSESSMENT → FINDING → PROPORTIONATE ACTION → INDEPENDENT APPEAL`

Phase 0.12 adds the complete Driver daily-operations truth:

`SECURE SESSION → APPROVED VEHICLE → ELIGIBILITY → SCHEDULED WORK → ONLINE → INFORMED OFFER → PICKUP → RIDECHECK → JOURNEY → EARNINGS REFRESH → NEXT OFFER / BREAK / FINISHING SOON → OFFLINE`

Phase 0.13 adds the unified Communications Core truth:

`PURPOSED COMMUNICATION → SCOPED RECIPIENT → VERSIONED TEMPLATE → SAFE ROUTE PLAN → SOURCE REVALIDATION → DELIVERY OBSERVATION → ACKNOWLEDGEMENT / HUMAN ESCALATION`

Phase 0.14 adds provider-disabled telephone, Voice Assistant and warm-handoff truth:

`CALL SESSION → SCOPED CALLER ASSESSMENT → STRUCTURED FIELD CAPTURE → READBACK → CONFIRMATION → CANONICAL BACKEND COMMAND / WARM HUMAN HANDOFF`

Important telephone and voice truth rules:

- Telephone is a channel into the same Booking, Pricing, Dispatch, Journey, Finance, Safety and Support owners, not a second reduced-function transport system.
- Caller ID and voice characteristics are routing/evidence hints, never identity authority. High-risk account, payout, payment-method and profile actions require independent step-up or remain prohibited over voice.
- Contact Plans preserve safe no-smartphone, basic-mobile, landline, intermediary, language and accessibility-communication needs without diagnoses or unrestricted third-party access.
- Pickup, destination, date/time, passenger, accessibility requirements and final price require structured confidence, explicit readback and confirmation before any canonical Booking command.
- Low confidence, repeated recognition failure, Safety, safeguarding, suspected takeover, caller distress and specialist needs require a warm, purpose-routed human handoff with confirmed context preserved.
- Operators and general voice never receive full card details. Payment `STATUS_UNKNOWN` requires reconciliation and never blind repeat collection.
- Dropped calls preserve confirmed pending state and idempotency; reconnect or callback cannot duplicate a Booking, cancellation or payment.
- Recordings, transcripts, corrections and interpreter sessions remain separate governed records. Transcripts are not operational authority, and voice biometrics are not enabled.
- Telephony, Voice Assistant, call-control, recording, transcription, interpreter and secure-payment execution providers remain disabled.

Phase 0.15 adds omnichannel policy, Contact Centre and communications-observability truth:

`AUTHORITATIVE EVENT → VERSIONED ROLE/CHANNEL POLICY → CURRENT-STATE REVALIDATION → DELIVERY / ACKNOWLEDGEMENT → FALLBACK → OWNED FAILURE CASE`

Important omnichannel operations truth rules:

- Every event-to-recipient/channel decision uses a versioned Notification Policy; Communications never invents Booking, Journey, Safety, Finance, Driver or Fleet state.
- Booker, passenger, payer, guardian, Driver and organisation messages are independently role-scoped from the same authoritative event.
- Stale assignments, Journey updates and payment messages are suppressed immediately before release.
- Silent Assistance do-not-call, payment `STATUS_UNKNOWN`, breakdown continuity, school safeguarding wording and marketing consent survive every fallback.
- Provider acceptance, SENT, DELIVERED, READ and ACKNOWLEDGED remain distinct evidence.
- A critical unreachable recipient opens an owned Communication Failure Case instead of repeated channel hammering.
- Contact Cases preserve owner, next action, attention time, temporary contactability, identity/permission state and cross-channel history without replacing canonical cases.
- P0/P1 cases cannot remain unowned, and personal email/SMS tools are prohibited as operator workarounds.
- Provider health and failover remain provider/region/purpose scoped; only approved alternates may preserve the original privacy, consent, template and audit rules.
- RECOVERING revalidates queued work against current state and discards stale items before release.
- Communications SLO evidence excludes sensitive message content and unrestricted case surveillance.
- Acceptance scenarios use approved fixtures, cover critical success/failure/fallback/stale/duplicate/order cases and never contact real users.
- External providers, Contact Centre staff mutations and scenario execution remain disabled.

Phase 0.16 closes the Communications Engine contract:

`VERSIONED DOMAIN EVENT → CANONICAL REQUEST → ROLE PERMISSION → SAFE ROUTE ORDER → DELIVERY / FALLBACK / OWNED FAILURE → ACCEPTANCE EVIDENCE → LAUNCH GATES`

Important final-closure truth rules:

- Communications transports authoritative Booking, Journey, Safety, School, Finance, Driver, Fleet, Support and Shield truth; it never invents or overrides it.
- Every request requires idempotency, an immutable versioned source event, an authoritative recipient reference and role, approved payload variables, a current state version, classification, acknowledgement policy and versioned fallback policy.
- Fourteen named critical event types, fifteen conceptual API operations and all twenty Communications P0 requirements are first-class versioned catalogues; catalogued mutations remain disabled.
- Raw phone/email destinations and arbitrary source-object dumps are rejected. Priority changes urgency and fallback, never data access.
- Passenger, booker, payer, guardian/carer, school, Driver, organisation, Control Room, Safety and rescue-partner scopes remain distinct and minimum-necessary.
- Channel selection follows the blueprint decision order and excludes compromised or purpose-ineligible contact points before any attempt.
- Provider acceptance and SENT remain insufficient; fallback revalidates source state, attempt caps stop hammering, and critical failure becomes owned work.
- Recovery discards duplicate and stale events. Shield outage pauses high-risk account/financial changes without stranding essential canonical Journey, Safety or safeguarding work.
- All eighteen end-to-end acceptance cases are fixture-only and provider-disabled; scenario success cannot come from contacting real people.
- All thirteen launch gates are separate from production policy, procurement/provider, staffing, security, accessibility and privacy/retention approvals.
- Endpoint availability grants no domain authority. Unmanaged provider calls, closure mutations and pilot launch remain disabled.

Phase 0.17 adds Organisation identity, tenancy, roles and booking-authority truth:

`ORGANISATION IDENTITY → ACTIVE MEMBERSHIP → GRANULAR PERMISSION → TENANT/SITE/COST SCOPE → BOOKING AUTHORITY → CANONICAL BOOKING`

Important Organisation Operations Part 1 truth rules:

- Business, school, authority, healthcare, care, community and partner accounts use one typed Organisation model without implying identical legal powers.
- Organisation identity, legal profile, site and cost centre remain separate versioned facts. Tenant isolation is enforced by the backend from authenticated active membership.
- There is no universal organisation administrator. Finance, booking, safeguarding, reporting and settings permissions remain distinct and scoped.
- SSO authenticates an identity but does not grant DAZAT permission. High-risk administration requires step-up and governed review evidence.
- Membership and roster entry do not create Booking authority, passenger ownership, consent, lawful basis or safeguarding authority.
- Booker, passenger and payer remain distinct canonical Booking parties. Organisation flows reuse the Booking and Journey engines.
- Organisation policy can narrow ordinary service/funding choices but cannot remove accessibility requirements, universal Safety or school safeguarding.
- A cost centre is allocation/reporting context and never Finance ledger, invoice, payment or refund truth.
- Approval is bound to explicit Booking and quote versions; material change requires reapproval while Safety-driven active-Journey action continues safely.
- Restrictions are scoped and cannot strand an active passenger or create a passenger/Driver finding.
- API clients and webhooks remain tenant/environment/permission scoped, signed, idempotent and replay-safe; webhook failure cannot mutate Booking.
- Exports are role/purpose/time scoped and minimised. Offboarding revokes authority without deleting lawful passenger identity or history.
- Organisation staff mutations, portal database editing, exports and external integrations remain disabled.

Important Communications Core truth rules:

- Booking, Journey, Safety, school safeguarding, payment, account-security, Driver, Support, business and marketing communications use one governed purpose-aware core.
- A Communication is separate from each MessageDelivery attempt. QUEUED, SENT, DELIVERED, READ, FAILED, EXPIRED, UNKNOWN and SUPPRESSED_STALE remain distinct facts.
- Marketing consent is separate and marketing cannot be relabelled as operational to bypass consent or quiet hours.
- Recipient person and role are scoped. Third-party booking does not create unrestricted financial, Safety or location visibility.
- Templates are immutable versions; critical templates require approval and account-security messages never request passwords, full PINs, OTPs or device-linking codes.
- Source aggregate versions are revalidated before delivery. Old assignment, Booking, Journey or payment messages are suppressed rather than sent stale.
- Critical acknowledgement failure, UNKNOWN delivery or a missed deadline can require human escalation; none is silently treated as acknowledged.
- Silent Assistance never falls back to an unsafe automatic call. Unverified, unavailable and compromised channels are excluded.
- Protected conversation and masked calling are time-bounded and never expose personal contact details.
- Push, SMS, email, telephony and chat providers remain disabled; no queued intent is presented as sent or delivered.

Important Driver daily-operations truth rules:

- BREAK and FINISHING_SOON are normal, non-punitive work intent; OFFLINE stops ordinary Driver-app location collection.
- Accepted scheduled commitments have protected windows and block conflicting Dispatch offers without blocking the committed Booking itself.
- A Driver offer must disclose pickup distance, pickup ETA, service/Journey context and an independently calculated Driver-earning estimate before acceptance.
- The Rider fare is never reused as the Driver earning. Missing route ETA or Finance-approved earning policy leaves acceptance disabled rather than creating a blind offer.
- Weak-signal reconciliation replaces speculative client state with authoritative availability and Journey versions. Queued critical events require canonical idempotent submission and are never marked executed by reconciliation.
- Arrival communication uses the chosen Booking pickup, not assumed passenger GPS, and protects direct contact details.
- Current demand and forecast stay separate, capability-aware and evidence-backed; neither guarantees earnings.
- Driver Support uses typed cases. High-risk active cases require human escalation, while this source foundation contacts no external provider or emergency service automatically.
- Voice readout, CarPlay and Android Auto remain explicit unconfigured roadmaps; voice input never bypasses backend validation.

Important Driver fair-treatment truth rules:

- DAZAT does not use an opaque Driver Score. Ratings, Safety, compliance, reliability, customer feedback, cancellations, training and security stay separate.
- A Rider rating is feedback, not an authorised finding, restriction or Dispatch-priority input.
- Complaint allegation, evidence, Driver response, assessment, finding and action are distinct records.
- Ordinary offer declines and timeouts do not create misconduct, acceptance-rate punishment or a hidden priority penalty.
- Reliability review starts from an accepted commitment and considers vehicle, system, provider, traffic and external causes.
- Temporary restrictions use the narrowest safe scope, are reviewable and are not guilt.
- High-impact findings, restrictions, offboarding and incentive qualification retain an independent appeal route that preserves original history.
- Safety-owned RiderConductCase protects Drivers from violence, harassment, discrimination, fraud and dangerous behaviour.
- The assigned Driver can terminate an unsafe Journey; Safety truth and passenger continuity persist, the rating is protected and no automatic Driver fault finding is created.
- Incentives require versioned visible terms, Finance approval and evidence; they cannot pressure unsafe fatigue, coerce acceptance or create secret Dispatch priority.
- Offboarding preserves earnings, disputes, vehicle-return obligations and historical Safety/Finance truth.

Important maintenance and reliability truth rules:

- Every operating vehicle fails closed without a current maintenance plan and current requirements.
- A Driver can say “something does not feel right” without diagnosis; a concern creates a precautionary restriction, not a Driver fault finding.
- Safety-review, do-not-use and unresolved safety-critical recall truth blocks Driver eligibility, Dispatch, Journey start, Marketplace visibility and assignment validation through one authoritative gate.
- Due/overdue work requires action but does not itself prove neglect or invent a legal prohibition.
- Defect, restriction, case, recall, warranty, estimate, authorisation, invoice, completion, inspection and return-to-service records remain separate and auditable.
- Repair authorisation requires warranty evaluation first; return to service requires completion, passed inspection, independent review, no active restriction and evidence.
- Breakdown/reliability evidence is separate from Driver maintenance compliance. Replacement is separate from passenger continuity and cannot penalise reporting.
- Driver perks are shown only after provider verification with explicit terms; whole-life cost includes acquisition through resale rather than brochure price alone.
- No real provider is selected and no staff repair, return-to-service or replacement mutation is exposed.

Important Fleet truth rules:

- Driver-owned, weekly rent, rent-to-own, fixed-term lease and lease-to-own are explicit access routes; Fleet tier remains separate.
- Marketplace offers are immutable versions and expose total cost, periodic charge, deposit, term, mileage, included/excluded services and end conditions.
- Published offers require verified supplier stock/warranty evidence. No generic discount percentage is promised.
- Vehicle capability is explicit and evidence-backed; body style never infers WAV, school, executive, airport or capacity truth.
- FleetAgreement and VehicleFinanceAgreement are versioned.
- Deposits are separate from platform revenue. Proposed deductions require condition evidence, agreement basis and a dispute route.
- Handover condition/equipment evidence is immutable and does not itself authorise a deduction.
- Driver–vehicle insurance is validated for the actual pair and is now part of Dispatch authorisation.
- Replacement assignment re-runs all Driver, vehicle, insurance, capability, agreement and operating checks.
- External FleetOrganisation tenancy never bypasses DAZAT authority.
- The Phase 0.9 API is read-only: no offer publication, reservation, agreement acceptance, deduction or vehicle assignment mutation is exposed.

Important Driver onboarding and operating truth rules:

- Authentication, application progress, compliance evidence, assessed competency, service permission, selected-vehicle eligibility and availability are separate facts.
- The Driver self-service API can start/resume an application and recognise existing verified-contact truth; it cannot approve any later stage.
- Only `REVIEW_PENDING` can transition to `APPROVED`, and the database requires an immutable authorised decision plus matching transition history.
- OCR/extraction is provenance, never authoritative compliance verification.
- Training attendance is not competency; high-risk permission requires current assessed competency evidence.
- Permissions are scoped by region/service and validity. School/WAV restrictions narrow matching services; a selected-vehicle restriction blocks that vehicle; payout restrictions do not silently become operating bans.
- Operating eligibility is derived with explicit blockers. Application approval and permission never place a Driver online; availability remains separate.
- No identity-verification provider or jurisdiction-specific licensing rules are selected or fabricated in this checkpoint.

Important Finance and ledger truth rules:

- Production charging is hard-disabled and no production provider is selected.
- A prepared PaymentIntent is not a Payment, charge, capture, receipt, ledger posting, DriverEarning or Payout.
- Payment state cannot jump directly from `CREATED` to `CAPTURED`.
- Provider timeouts become `STATUS_UNKNOWN`; reconciliation is required and blind retry is forbidden.
- Money uses integer minor units and uppercase three-letter currency codes.
- Posted ledger transactions must balance debits and credits in one currency.
- Posted transactions and entries are immutable; corrections use linked reversal transactions.
- Raw PAN, CVV/CVC, PIN and track data are prohibited; only provider token references and safe metadata are modelled.
- DriverEarning and Payout are separate, and Rider fare is never presented as a Driver earning.
- A receipt exists only after captured Payment truth.
- Payout destination changes remain a separate high-risk, step-up workflow.

The earlier Journey integrity and Safety rules remain enforced:

- Active telemetry begins only after protected Journey start and remains explicitly `LIVE`, `DELAYED`, `DEGRADED`, `STALE` or `UNKNOWN`.
- Out-of-order points and impossible jumps are retained as degraded evidence; they do not become automatic misconduct findings.
- Reconnecting clients replace speculative state with an authoritative snapshot.
- Journey health is `NORMAL`, `ATTENTION`, `AT_RISK` or `INCIDENT`; restricted Safety facts stay with the Safety owner.
- SOS, Silent Assistance and route concerns persist before downstream delivery attempts.
- Silent Assistance sets `do_not_auto_call_reporter=true` and canonical persistence never depends on an external provider.
- Route concerns are contextual, graded evidence and are database-constrained against automatic misconduct findings.
- Stop/destination requests are versioned and pending; they do not change the route until pricing, authority, communication and Driver acknowledgement rules succeed.
- `ARRIVING` requires fresh, accurate, confident, movement-plausible destination evidence.
- Completion requires active assignment, accepted destination evidence, no completion hold, no continuity blocker and any required authorised handover.
- School, hospital and specialist service contexts fail closed when handover evidence is missing or failed.
- Completion closes Journey, Booking, leg and assignment and returns the Driver to `AVAILABLE` atomically.
- Completion does not initiate or imply payment.

See `BUILD_STATUS.md`, `docs/architecture/ADR-0017-organisation-identity-tenancy-authority.md`, and `docs/engineering/phase-0-17-checklist.md` for evidence and limitations.
