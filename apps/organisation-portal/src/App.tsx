import { dazatTokens } from '@dazat/design-system';

const panel = {
  maxWidth: 760,
  marginTop: 18,
  padding: 24,
  background: dazatTokens.color.surface,
  border: `1px solid ${dazatTokens.color.border}`,
  borderRadius: dazatTokens.radius.card
} as const;

export function App() {
  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.17 · READ-ONLY FOUNDATION</p>
      <h1>DAZAT Organisation Portal</h1>
      <p style={{ maxWidth: 760, lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
        This shell presents only organisations where the authenticated person has a current active membership. The backend enforces organisation, site, cost-centre, purpose and permission scope; a client-supplied organisation identifier never grants access.
      </p>

      <section aria-label="Organisation authority" style={panel}>
        <h2 style={{ marginTop: 0 }}>An organisation governs access — it does not own the passenger</h2>
        <ul style={{ lineHeight: 1.8, color: dazatTokens.color.textMuted }}>
          <li>Organisation identity, legal profile, sites and cost centres remain separate versioned records.</li>
          <li>Membership does not itself grant booking authority; an active rule, agreement, permission and passenger population are required.</li>
          <li>Booker, passenger and payer remain distinct parties in the canonical Booking engine.</li>
          <li>Roster membership never transfers passenger identity, consent, safeguarding authority or lawful-basis ownership.</li>
        </ul>
      </section>

      <section aria-label="Role and policy boundaries" style={panel}>
        <h2 style={{ marginTop: 0 }}>There is no universal organisation admin</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Finance, booking, school handover, safeguarding, reporting and settings capabilities are granted independently and only within the authorised site, cost-centre, service and passenger-group scope. High-risk administration needs step-up, four-eyes evidence and a permitted Shield decision.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          An organisation policy may narrow ordinary service and funding choices, but it cannot disable accessibility requirements, universal Safety functions or school safeguarding. A scoped restriction cannot strand an active passenger Journey.
        </p>
      </section>

      <section aria-label="Read-only checkpoint" style={panel}>
        <h2 style={{ marginTop: 0 }}>Portal editing and integrations are disabled</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          This checkpoint provides public capability truth and authenticated tenant-scoped reads only. The portal is never a direct database editor. Staff mutations, API credential use, webhook delivery, bulk import, export execution and external integration execution are not enabled.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Finance remains the ledger owner. A cost centre is allocation and reporting context, not a balance, invoice, payment or refund record. Offboarding revokes organisation authority while preserving lawful passenger identity, Booking, Journey, Safety and finance history.
        </p>
      </section>
    </main>
  );
}
