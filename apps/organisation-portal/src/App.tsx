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
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.20 · READ-ONLY FOUNDATION</p>
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

      <section aria-label="Agreement and policy governance" style={panel}>
        <h2 style={{ marginTop: 0 }}>A contract shapes service — it never weakens hard protection</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Agreement documents, service policies, pricing schedules, approval rules, billing rules, reporting rules and SLA definitions remain separate effective-dated versions. Commercial preference sits below legal, Safety, safeguarding, accessibility and current Driver/vehicle/service eligibility. Historical Bookings retain the versions under which they were created.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Approval is not Booking confirmation or a Driver assignment. Missing purchase-order or funding data opens an explicit exception and never silently charges a passenger's personal payment method. Billing configuration feeds the canonical Finance Engine; portal users cannot edit ledger or closed-invoice truth.
        </p>
      </section>

      <section aria-label="Performance and lifecycle governance" style={panel}>
        <h2 style={{ marginTop: 0 }}>Targets, credit and contract exit remain truthful</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          SLA metrics retain their definition, population, time window, evidence source and cause. Stale GPS is not proof of lateness or no-show, Safety incidents cannot be hidden for performance, and an organisation allegation is evidence rather than automatic Driver guilt.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Credit restriction, suspension, expiry and termination may govern new ordinary work but cannot strand an active passenger. Future Bookings receive an explicit disposition before pickup. Reinstatement revalidates agreement, credit, security, documents, contacts and API credentials; migration flags never bypass current eligibility.
        </p>
      </section>

      <section aria-label="Institutional live operations" style={panel}>
        <h2 style={{ marginTop: 0 }}>The Control Room is a scoped lens, never a shadow trip system</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Live attention, readiness and exception summaries retain canonical Booking, Dispatch and Journey truth. P0–P3 work needs an owner, next action and deadline. RESOLVED remains separate from VERIFIED, and specialist Safety, Finance, Rescue and Compliance cases stay authoritative.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          Manual assignment still applies every Driver, vehicle, accessibility and safeguarding eligibility rule. Capacity shortages become explicit NO_ELIGIBLE_DRIVER or partner exceptions; portal outages do not authorise spreadsheet dispatch, personal-message workarounds or direct database editing.
        </p>
      </section>

      <section aria-label="Institutional continuity and launch" style={panel}>
        <h2 style={{ marginTop: 0 }}>Readiness, pilots and exit preserve the active passenger</h2>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          School handover failures block ordinary completion and enter safeguarding. Hospital PASSENGER_NOT_READY remains distinct from no-show. Funding expiry governs future service only, site closures affect scoped occurrences, and a breakdown keeps one canonical Booking and Journey while passenger continuity and vehicle rescue proceed in parallel.
        </p>
        <p style={{ lineHeight: 1.7, color: dazatTokens.color.textMuted }}>
          A signed contract alone cannot launch service. Agreement, funding, contacts, schedules, specialist capacity, communications, support and contingency gates must pass, followed by any required pilot. Contract exit inventories future work, revokes access deliberately, preserves lawful records and open cases, and never abandons an active passenger.
        </p>
      </section>
    </main>
  );
}
