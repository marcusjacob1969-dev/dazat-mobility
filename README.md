# DAZAT Mobility

Production engineering source created from the DAZAT Mobility Master Blueprint v0.4.

Current checkpoint: **Engineering Phase 0.8**.

The server-authoritative vertical slice now reaches governed Journey completion:

`REGISTER → VERIFY → SESSION → BOOKING → QUOTE → CONFIRM → HARD-FILTERED DISPATCH → ATOMIC ASSIGNMENT → EVIDENCED PICKUP → RIDECHECK → PROTECTED START → LIVE JOURNEY → ARRIVING → GOVERNED COMPLETION`

Phase 0.7 extends the completed vertical slice into a provider-disabled Finance foundation:

`GOVERNED COMPLETION → PREPARE PAYMENT INTENT (NO CHARGE) → CANONICAL STATUS / RECEIPT NOT READY`

Phase 0.8 adds the evidence and authority boundary required before Driver operations:

`APPLICATION START → VERIFIED CONTACT RECOGNISED → IDENTITY / DOCUMENT / TRAINING / VEHICLE EVIDENCE → AUTHORISED REVIEW → SCOPED PERMISSION → DERIVED OPERATING ELIGIBILITY`

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

See `BUILD_STATUS.md`, `docs/architecture/ADR-0008-driver-onboarding-operating-permission-truth.md`, and `docs/engineering/phase-0-8-checklist.md` for evidence and limitations.
