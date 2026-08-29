import { dazatTokens } from '@dazat/design-system';

export function App() {
  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.9</p>
      <h1>DAZAT Control Room</h1>
      <p style={{ maxWidth: 680, color: dazatTokens.color.textMuted }}>
        Active Journey projection shell. Authorised operations see canonical health, telemetry confidence, route concerns and completion requirements. This surface is never a direct database editor and normal support cannot bypass evidence, Safety or handover boundaries.
      </p>
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
      <section aria-label="Completion boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Completion is a governed command</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Silence, disconnect or a map animation never completes a Journey. Completion requires ARRIVING state, fresh destination evidence, an active assignment, no completion hold and any required handover. Payment is not initiated by this Phase 0.6 command.
        </p>
      </section>
    </main>
  );
}
