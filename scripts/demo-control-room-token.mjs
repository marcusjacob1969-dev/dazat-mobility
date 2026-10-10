// Prints a fresh (about one hour) session token for the demo Control Room operator.
// Test environments only: relies on the API's development verification code.
//   node scripts/demo-control-room-token.mjs
const API = (process.env.API_URL ?? 'https://dazat-mobility-1.onrender.com').replace(/\/$/, '');
const accountId = process.env.DEMO_OPERATOR_ACCOUNT_ID ?? '546b074e-1ce7-4c05-9555-633a5fd83fc0';
const contactPointId = process.env.DEMO_OPERATOR_CONTACT_ID ?? 'b74c0f01-ddb2-4038-8d42-15145fb54e70';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

const verification = await post('/v1/identity/verifications/contact', { accountId, contactPointId });
const confirmed = await post('/v1/identity/verifications/contact/confirm', {
  verificationId: verification.verificationId,
  code: verification.developmentCode,
  device: { deviceInstanceId: `demo-operator-${Date.now()}-device`, platform: 'DEMO' }
});
console.log(`Session token (valid until ${confirmed.session.expiresAt}):`);
console.log(confirmed.session.bearerToken);
