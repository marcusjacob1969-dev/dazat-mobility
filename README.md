# DAZAT Mobility

Production engineering source created from the DAZAT Mobility Master Blueprint v0.4.

Current checkpoint: **Engineering Phase 0.10**.

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

See `BUILD_STATUS.md`, `docs/architecture/ADR-0010-maintenance-defect-reliability-truth.md`, and `docs/engineering/phase-0-10-checklist.md` for evidence and limitations.
