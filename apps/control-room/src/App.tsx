import { dazatTokens } from '@dazat/design-system';

export function App() {
  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.5</p>
      <h1>DAZAT Control Room</h1>
      <p style={{ maxWidth: 680, color: dazatTokens.color.textMuted }}>
        Assignment-to-pickup projection shell. Authorised operations see canonical Journey/Booking state, telemetry freshness and protected-start holds. This surface is never a direct database editor and normal support cannot bypass failed RideCheck, changed assignment eligibility or a Safety hold.
      </p>
      <section aria-label="Journey projection contract" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Authoritative pickup controls</h2>
        <ul style={{ lineHeight: 1.8, color: dazatTokens.color.textMuted }}>
          <li>Location state is labelled LIVE, DELAYED, DEGRADED, STALE or UNKNOWN.</li>
          <li>Arrival is supported by durable geofence evidence; GPS alone is not proof of no-show or misconduct.</li>
          <li>RideCheck mismatch blocks ordinary start and opens an assessment path without declaring guilt.</li>
          <li>Every critical mutation revalidates the Journey owner instead of trusting this projection.</li>
        </ul>
      </section>
    </main>
  );
}
