import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const routes = readFileSync(new URL('../services/api/src/modules/finance/routes.ts', import.meta.url), 'utf8');
const service = readFileSync(new URL('../services/api/src/modules/finance/finance-service.ts', import.meta.url), 'utf8');
const http = readFileSync(new URL('./verify-core-journey-http-postgres.mjs', import.meta.url), 'utf8');

assert.match(routes, /\/v1\/bookings\/:bookingId\/payment-intents/);
assert.match(routes, /\/v1\/payments\/:paymentId\/status/);
assert.doesNotMatch(routes, /\/capture|\/charge|\/refund/);
assert.match(service, /productionChargingEnabled: false/);
assert.match(service, /providerActionAttempted: false/);
assert.match(service, /charging_eligibility.*NOT_ELIGIBLE|NOT_ELIGIBLE/);
assert.match(http, /productionChargingEnabled, false/);
assert.match(http, /providerActionAttempted, false/);
assert.match(http, /status, 'CREATED'/);

console.log('Phase 0.121 provider-disabled finance boundary verifier PASSED');
