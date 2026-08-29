import { dazatTokens } from '@dazat/design-system';

export function App() {
  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.6</p>
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
      <section aria-label="Completion boundary" style={{ maxWidth: 720, marginTop: 16, padding: 24, border: `1px solid ${dazatTokens.color.border}`, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Completion is a governed command</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Silence, disconnect or a map animation never completes a Journey. Completion requires ARRIVING state, fresh destination evidence, an active assignment, no completion hold and any required handover. Payment is not initiated by this Phase 0.6 command.
        </p>
      </section>
    </main>
  );
}
