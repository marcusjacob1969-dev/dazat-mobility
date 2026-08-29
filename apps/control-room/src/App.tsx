import { dazatTokens } from '@dazat/design-system';

export function App() {
  return (
    <main style={{ minHeight: '100vh', background: dazatTokens.color.canvas, color: dazatTokens.color.textPrimary, fontFamily: `${dazatTokens.typography.family}, ${dazatTokens.typography.fallback}`, padding: 32 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: dazatTokens.color.textMuted }}>ENGINEERING PHASE 0.4</p>
      <h1>DAZAT Control Room</h1>
      <p style={{ maxWidth: 680, color: dazatTokens.color.textMuted }}>
        Dispatch foundation projection shell. Control Room will consume authorised read models and commands; it cannot bypass hard Driver, compliance, vehicle, accessibility or safeguarding eligibility rules and is never a direct database editor.
      </p>
    </main>
  );
}
