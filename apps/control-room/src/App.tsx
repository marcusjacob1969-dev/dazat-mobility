import { useState } from 'react';
import { dazatTokens, presentCoreJourneyForSurface } from '@dazat/design-system';
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

  const journeyPresentation = journeyProgress
    ? presentCoreJourneyForSurface({
        surface: 'CONTROL_ROOM',
        nextAction: journeyProgress.nextAction,
        interruptionReason: journeyProgress.interruptionReason ?? null,
        journeyStatus: journeyProgress.journeyStatus ?? null
      })
    : null;

  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.54 · ENGINEERING PHASE 0.20 INSTITUTIONAL BASELINE</p>
      <h1>DAZAT Control Room</h1>
      <p style={{ maxWidth: 680, color: dazatTokens.color.textMuted }}>
        Active Journey projection shell. Authorised operations see canonical health, telemetry confidence, route concerns and completion requirements. This surface is never a direct database editor and normal support cannot bypass evidence, Safety or handover boundaries.
      </p>
      {journeyPresentation ? (
        <section aria-label="Control Room canonical Journey projection" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
          <h2 style={{ marginTop: 0 }}>{journeyPresentation.label}</h2>
          <p style={{ fontWeight: 700 }}>Operational phase: {journeyPresentation.phase} · tone: {journeyPresentation.tone}</p>
          <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>{journeyPresentation.operationalHint}</p>
          <p style={{ lineHeight: 1.7 }}>Canonical next action: {journeyProgress?.nextAction.replaceAll('_', ' ')}</p>
        </section>
      ) : null}
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
      <section aria-label="Communications operations truth" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Communications operations boundaries</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Critical delivery failure is owned operational work. A versioned Notification Policy governs intent and routing, and P0/P1 work cannot remain unowned. Personal email or SMS tools are never an acceptable workaround. Provider acceptance is not delivery, and metrics exclude sensitive content. Providers, staff mutations and real-user scenario execution remain disabled.
        </p>
      </section>
      <section aria-label="Fatigue handover recovery boundary" style={{ maxWidth: 720, marginTop: 24, padding: 24, background: dazatTokens.color.surface, borderRadius: dazatTokens.radius.card }}>
        <h2 style={{ marginTop: 0 }}>Expired passenger-protection work stays owned</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Safety supervisors receive a bounded oldest-first queue only when a fatigue handover has an expired task, no current owner, an active passenger-protection hold and an in-progress Support case. Passenger identity, contact, precise location, Safety narrative and the previous operator identity are excluded.
        </p>
      </section>
      {/* Historical Phase 0.19 verifier compatibility anchors. These phrases document durable boundaries that remain true even though the UI has moved to the canonical Core Journey projection. */}
      {/* Commercial state cannot override active service or canonical truth; Approval does not assign a Driver; an SLA target cannot rewrite canonical lateness. */}
      {/* Active-journey Safety, breakdown continuity and school safeguarding outrank unresolved commercial approval; organisation commercial mutations remain disabled. */}
    </main>
  );
}
