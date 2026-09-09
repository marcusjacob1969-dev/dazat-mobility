import { useState } from 'react';
import { dazatTokens } from '@dazat/design-system';
import type { CoreJourneyProgressProjection } from '@dazat/contracts';
import { readTaskScopedCoreJourneyProgress } from './core-journey-api.js';

export function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3001');
  const [bearerToken, setBearerToken] = useState('');
  const [controlledHandoverId, setControlledHandoverId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [journeyProgress, setJourneyProgress] = useState<CoreJourneyProgressProjection | null>(null);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  async function loadJourneyProgress() {
    setJourneyLoading(true); setJourneyError(null);
    try { setJourneyProgress(await readTaskScopedCoreJourneyProgress(apiBaseUrl, bearerToken, controlledHandoverId, bookingId)); }
    catch (error) { setJourneyProgress(null); setJourneyError(error instanceof Error ? error.message : 'CONTROL_ROOM_JOURNEY_PROGRESS_FAILED'); }
    finally { setJourneyLoading(false); }
  }

  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.54 · ENGINEERING PHASE 0.20 INSTITUTIONAL BASELINE</p>
      <h1>DAZAT Control Room</h1>
      <p style={{ maxWidth: 680, color: dazatTokens.color.textMuted }}>
        Active Journey projection shell. Authorised operations see canonical health, telemetry confidence, route concerns and completion requirements. This surface is never a direct database editor and normal support cannot bypass evidence, Safety or handover boundaries.
      </p>
      <section aria-label="Task-scoped core journey progress" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Task-scoped journey progress</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>Loads only through a current fatigue-handover task. An ID alone grants no access.</p>
        <label style={{ display: 'block', marginTop: 12 }}>API base URL<input aria-label="API base URL" type="url" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 10 }} /></label>
        <label style={{ display: 'block', marginTop: 12 }}>Session token<input aria-label="Session token" type="password" value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 10 }} /></label>
        <label style={{ display: 'block', marginTop: 12 }}>Controlled handover ID<input aria-label="Controlled handover ID" value={controlledHandoverId} onChange={(event) => setControlledHandoverId(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 10 }} /></label>
        <label style={{ display: 'block', marginTop: 12 }}>Booking ID<input aria-label="Booking ID" value={bookingId} onChange={(event) => setBookingId(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 10 }} /></label>
        <button type="button" disabled={journeyLoading || !bearerToken || !controlledHandoverId || !bookingId} onClick={() => void loadJourneyProgress()} style={{ marginTop: 16, padding: '10px 16px' }}>{journeyLoading ? 'Loading…' : 'Load journey progress'}</button>
        {journeyError ? <p role="alert">{journeyError}</p> : null}
        {journeyProgress ? <div aria-live="polite" style={{ marginTop: 16 }}><strong>{journeyProgress.disposition.replaceAll('_', ' ')}</strong><p>Next: {journeyProgress.nextAction.replaceAll('_', ' ')}</p><ul>{journeyProgress.milestones.map((item) => <li key={item.name}>{item.name.replaceAll('_', ' ')} — {item.status.replaceAll('_', ' ')}</li>)}</ul></div> : null}
      </section>
      <section aria-label="Fatigue handover recovery boundary" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Expired passenger-protection work stays owned</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Safety supervisors receive a bounded oldest-first queue only when a fatigue handover has an expired task, no current owner, an active passenger-protection hold and an in-progress Support case. Passenger identity, contact, precise location, Safety narrative and the previous operator identity are excluded.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Queue eligibility is advisory. Recovering ownership requires a separate evidence-backed, idempotent command that revalidates current authority and authoritative state under lock. It preserves the hold and claims no completed handover, external contact or Driver recovery.
        </p>
      </section>
      <section aria-label="Journey projection contract" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Authoritative active Journey controls</h2>
        <ul style={{ lineHeight: 1.8, color: dazatTokens.color.textMuted }}>
          <li>Location state is labelled LIVE, DELAYED, DEGRADED, STALE or UNKNOWN.</li>
          <li>Journey health is NORMAL, ATTENTION, AT_RISK or INCIDENT; restricted Safety facts are not copied into general projections.</li>
          <li>Route deviation severity is contextual evidence and never an automatic misconduct finding.</li>
          <li>Stop and destination requests remain pending until pricing, authority, communication and Driver acknowledgement rules pass.</li>
          <li>School, hospital and specialist completion remains blocked until an authorised handover is recorded.</li>
          <li>Reconnect uses an authoritative snapshot and every mutation revalidates aggregate state.</li>
        </ul>
      </section>
      <section aria-label="Finance truth boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Finance truth is provider-neutral and charging-disabled</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          PaymentIntent, Payment, ledger transaction, DriverEarning and Payout remain separate records. Amounts use integer minor units. A provider timeout becomes STATUS_UNKNOWN and must be reconciled; Control Room cannot blindly retry it and cannot directly edit a balance.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          No production provider is configured in this checkpoint. A prepared intent is not a charge, Journey completion is not payment, the Rider fare is not a Driver earning, and payout destination changes remain a separate high-risk workflow.
        </p>
      </section>
      <section aria-label="Driver operating authority boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Driver approval is evidence-based and scoped</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Account authentication, application progress, document extraction, assessed competency, service permission, selected-vehicle eligibility and online availability remain separate truths. OCR is provenance, never authoritative compliance verification.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Control Room cannot directly set APPROVED or invent a broad ban. Restrictions are narrow — such as School, WAV, new journeys, payout or one vehicle — and precautionary restrictions are not findings of guilt.
        </p>
      </section>
      <section aria-label="Fleet authority boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Fleet terms are evidence, not marketing shorthand</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Marketplace publication requires verified supplier stock and warranty terms plus total cost, deposit, term, mileage, included/excluded services and end-of-term conditions. Control Room cannot invent a generic discount or infer WAV, school, executive or airport capability from body style.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Deposits remain separate from revenue; any proposed deduction needs condition evidence, agreement basis and a dispute route. External FleetOrganisation tenancy never bypasses DAZAT Driver, vehicle, insurance, training, compliance or Safety checks, and every replacement assignment is revalidated.
        </p>
      </section>
      <section aria-label="Maintenance authority boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Maintenance safety overrides commercial pressure</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          A Driver may report that something does not feel right without diagnosing a fault. Safety concerns create a precautionary vehicle restriction, not a Driver fault finding; dispatch and Journey start consume the same authoritative maintenance gate.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Estimates, warranty evaluation, repair authorisation, invoices, completion evidence and reviewed return-to-service remain separate records. Breakdown evidence does not prove neglect, replacement remains separate from passenger continuity, and only provider-verified perk terms may be shown.
        </p>
      </section>
      <section aria-label="Driver fair treatment boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Fair treatment has no opaque Driver Score</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Ratings, Safety, compliance, reliability, customer feedback, cancellations, training and security remain separate evidence dimensions. A rating is feedback, not a finding; ordinary offer declines and timeouts are not misconduct and never create a hidden Dispatch-priority penalty.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Complaint allegation, evidence, Driver response, assessment, finding and action remain distinct records. Temporary restrictions use the narrowest safe scope, are reviewable and are not guilt. High-impact findings, restrictions, offboarding and incentive qualification retain an independent appeal route with the original decision history preserved.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          RiderConductCase is Safety-owned and protects Drivers reporting violence, harassment, discrimination, fraud or dangerous behaviour. Safe Journey termination opens passenger continuity, protects the Driver rating and creates no automatic Driver fault finding.
        </p>
      </section>
      <section aria-label="Driver daily operations boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Driver daily operations stay truthful under pressure</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Secure session, approved vehicle, eligibility, scheduled work, availability, informed offer, pickup, RideCheck, Journey, earnings, break, FINISHING_SOON and end-shift remain separate states. BREAK and FINISHING_SOON are normal work intent, not misconduct; OFFLINE ends ordinary Driver-app location collection.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Blind offers fail closed. Pickup distance and ETA, service type, permitted Journey context and a Finance-approved Driver-earning estimate must be visible before acceptance. The Rider fare is never reused as the Driver earning, and ordinary decline remains non-punitive.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Weak-signal reconciliation replaces speculative client state but never marks queued SOS, silent assistance, conduct or location events as executed. Current demand and forecast are labelled separately, supply is measured by capability, and no heatmap guarantees earnings.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Driver Support separates safety, breakdown, payment, account, compliance, technical, passenger and fleet cases. High-risk active cases require human escalation; this checkpoint contacts no external provider or emergency service automatically.
        </p>
      </section>
      <section aria-label="Completion boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Completion is a governed command</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Silence, disconnect or a map animation never completes a Journey. Completion requires ARRIVING state, fresh destination evidence, an active assignment, no completion hold and any required handover. Payment is not initiated by this Phase 0.6 command.
        </p>
      </section>
      <section aria-label="Communications authority boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Communication intent is not delivery truth</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Booking, Journey, Safety, safeguarding, payment, account security, Driver operations, Support, business and marketing messages use one purpose-aware core. Marketing consent is separate and marketing cannot be relabelled as operational. Recipient roles are scoped, templates are versioned and critical templates require approval.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          QUEUED, SENT, DELIVERED, READ, FAILED, EXPIRED and UNKNOWN remain distinct delivery observations. Stale source versions are suppressed before delivery, silent assistance never falls back to an unsafe voice call, and failed critical acknowledgement requires human escalation. Protected conversation and masked calling never expose personal contact details.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          SMS, email, push, telephony and chat providers remain disabled. Control Room cannot claim a message was sent, blindly retry UNKNOWN, override recipient consent or turn caller ID into identity proof.
        </p>
      </section>
      <section aria-label="Telephone and voice authority boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Telephone is a channel, not a second transport system</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Calls and Voice Assistant input must use the same Booking, Pricing, Dispatch, Journey, Finance, Safety and Support commands as apps. Caller ID is only a routing hint. Claimed roles, verification methods, confidence, restrictions and step-up remain explicit before any scoped disclosure or change.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Pickup, destination, date/time, passenger, accessibility requirements and final fare terms require structured capture, readback and confirmation. Low confidence, repeated recognition failure, Safety, safeguarding, suspected takeover, distress and high-risk changes require warm human handoff with the confirmed context preserved.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Operators and general voice never receive full card details. STATUS_UNKNOWN requires reconciliation, a dropped call cannot duplicate a Booking or payment, transcripts are not operational authority and voice biometrics are not enabled. Telephony, Voice Assistant, recording, transcription and interpreter providers remain disabled.
        </p>
      </section>
      <section aria-label="Omnichannel operations authority boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Critical delivery failure is owned operational work</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Every event-to-role/channel decision uses a versioned Notification Policy and an authoritative domain event. Booker, passenger, payer, guardian, Driver and organisation content stays scoped; Communications cannot invent Booking, Journey, Safety, Finance, Driver or Fleet state.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Contact Cases preserve owner, priority, next action, attention time, contactability and the cross-channel timeline while linking back to canonical cases. P0/P1 work cannot remain unowned, and personal email or SMS tools are never an acceptable workaround.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Provider acceptance is not delivery. SLO metrics exclude sensitive content, contactability is temporary context rather than a personal rating, and outage recovery revalidates current state before releasing queued work. Providers, staff mutations and real-user scenario execution remain disabled.
        </p>
      </section>
      <section aria-label="Communications final closure boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Final closure does not grant operational authority</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Every canonical CommunicationRequest references an immutable versioned source event, authoritative recipient, approved payload variables, template version, state version, classification, acknowledgement rule and fallback policy. Priority changes urgency and routing; it never grants broader access.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Fourteen critical event contracts, fifteen conceptual API operations and all twenty P0 requirement IDs are explicit versioned catalogues. A catalogued operation is not an implemented command and cannot bypass its owning backend.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          The delivery decision order resolves current source state, role permission, purpose, safe contact points, accessibility and language, channel exclusions and active policy before any attempt. SENT remains insufficient, stale fallback is prohibited, and critical failure becomes an owned case.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Eighteen acceptance cases and thirteen launch gates are explicit. Source evidence cannot substitute for provider selection, policy approval, staffing, privacy/retention approval, drills or runbooks. Unmanaged provider calls, closure mutations, real-user scenarios and pilot launch remain disabled.
        </p>
      </section>
      <section aria-label="Organisation operations boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Organisation access is tenant-, role- and purpose-scoped</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Business, school, authority, healthcare, care, community and partner accounts use one governed Organisation model. Membership is not universal authority: site, cost-centre, role, purpose, valid dates, booking rules and agreements are revalidated by the backend.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Control Room cannot make an organisation own a passenger, infer safeguarding authority from a finance role, downgrade accessibility or Safety, turn a cost centre into ledger truth, and cannot strand an active Journey because an account is in arrears.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Organisation mutations, external API execution, webhook delivery, export execution and direct database editing remain disabled. Offboarding revokes organisation authority without deleting lawful passenger, Booking, Journey, Safety or Finance history.
        </p>
      </section>
      <section aria-label="Institutional transport boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Institutional preparation never replaces Booking or Journey truth</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Rosters, funding authority, recurring templates, calendars, readiness and bulk batches constrain canonical transport. Every occurrence is a separate Booking; templates reserve no Driver and create no Finance liability. Active Journeys cannot be changed by editing a series or relabelling its passenger.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Control Room cannot use familiarity to bypass school Driver/vehicle eligibility, downgrade WAV or safeguarding requirements, treat PASSENGER_NOT_READY as an automatic no-show, or let a malformed bulk row create an ambiguous partial result. Breakdown continuity preserves the original Booking/Journey and passenger requirements.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Institutional exceptions remain owned work with priority, next action and outcome. Routine organisation support never absorbs Safety or School command authority, and all institutional mutation execution remains disabled.
        </p>
      </section>
      <section aria-label="Organisation commercial governance boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Commercial state cannot override active service or canonical truth</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Agreement, policy, pricing, approval, billing, credit and SLA records are independently versioned context. Approval does not assign a Driver, cost centres and PO numbers do not edit the ledger, and an SLA target cannot rewrite canonical lateness, no-show, Safety or conduct classifications.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Active-journey Safety, breakdown continuity and school safeguarding outrank unresolved commercial approval. Account suspension, arrears, expiry or termination can restrict new ordinary work only after future Bookings receive explicit treatment; active passengers and lawful Finance, Safety, safeguarding and audit evidence remain protected.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Contract simulation, API/webhook execution, migration commit, export execution, service-credit creation and organisation commercial mutations remain disabled at this checkpoint.
        </p>
      </section>
      <section aria-label="Institutional live operations boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Institutional operations stay canonical, owned and verifiable</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          This Control Room is a task-scoped lens, not a second trip system. P0–P3 attention needs an owner, next action and deadline. An institutional exception links to canonical Booking or series truth and remains separate from Safety, Finance, Rescue and Compliance; RESOLVED never silently means VERIFIED.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Readiness does not guarantee a Driver. Manual Dispatch and partner overflow still enforce current Driver, vehicle, accessibility and safeguarding eligibility. A failed school handover blocks completion, hospital PASSENGER_NOT_READY is not no-show, and a breakdown keeps one Booking and Journey while continuity and rescue run in parallel.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Outages never authorise spreadsheet or personal-message shadow dispatch. Tracking expires after operational need, service health cannot cancel a Booking, AI cannot invent authority or close safeguarding, and all institutional live mutations remain disabled.
        </p>
      </section>
      <section aria-label="Institutional launch pilot and exit boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>A signed agreement alone never enables launch</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Agreement, funding, contacts, roster, schedules, specialist capacity, safeguarding, communications, support and contingency gates require evidence. Any required pilot remains bounded by geography, cohort, service, hours and volume, and a failed gate blocks expansion without accountable risk acceptance.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Exit inventories active and future work, stops new authority deliberately, times access revocation, governs exports and preserves lawful records and open cases. Contract closure can never abandon an active passenger.
        </p>
      </section>
    </main>
  );
}
