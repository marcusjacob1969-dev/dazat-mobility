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
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.18 · READ-ONLY FOUNDATION</p>
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

      <section aria-label="Institutional transport boundary" style={panel}>
        <h2 style={{ marginTop: 0 }}>Every recurring occurrence is its own canonical Booking</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Passenger rosters, funding authorisations, service eligibility, templates, series, calendars and bulk files only prepare or constrain transport. A template does not reserve a Driver, create Finance liability or become an active Journey. Every generated occurrence keeps its own Booking state, template/agreement/policy provenance and audit history.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          The same passenger may have separate, invisible relationships with several organisations. Local pupil, employee, hospital or authority references never become a cross-tenant identity key. Roster removal revokes future authority without deleting the passenger or unrelated organisation relationships.
        </p>
      </section>

      <section aria-label="Scheduling and bulk safety" style={panel}>
        <h2 style={{ marginTop: 0 }}>Readiness, recurrence and bulk work stay explicit</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          School calendars preserve closure, eligibility, accessibility and handover rules. Familiar Driver continuity is only a preference after current Driver, vehicle and safeguarding checks. Hospital or care PASSENGER_NOT_READY is not automatically a no-show, and pickup windows never claim guaranteed instant collection.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Bulk imports require a dry run, row-level outcomes, tenant-safe duplicate detection and idempotent commit. Passenger substitution, cancellation and active-Journey changes return to canonical Booking/Journey rules. Institutional mutations and external execution remain disabled.
        </p>
      </section>
    </main>
  );
}
