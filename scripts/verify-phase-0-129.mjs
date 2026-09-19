import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../services/api/src/modules/finance/routes.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../services/api/src/modules/finance/finance-service.ts', import.meta.url), 'utf8');

const mutationRoutes = [...source.matchAll(/app\.(post|put|patch|delete)\(['"]([^'"]+)/g)].map((match) => ({
  method: match[1].toUpperCase(),
  path: match[2]
}));

assert.deepEqual(mutationRoutes, [
  { method: 'POST', path: '/v1/bookings/:bookingId/payment-intents' }
]);
for (const forbidden of ['capture', 'charge', 'refund']) {
  assert.equal(source.toLowerCase().includes('/' + forbidden), false, 'Finance route surface exposes forbidden mutation: ' + forbidden);
}
assert.equal(service.includes('productionChargingEnabled: false'), true);
assert.equal(service.includes('No provider action was attempted.'), true);

console.log('DAZAT Phase 0.129 Finance mutation-surface boundary verification PASSED');
