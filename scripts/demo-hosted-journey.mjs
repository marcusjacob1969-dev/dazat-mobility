// Drives one full provider-disabled journey against a running DAZAT API over HTTP:
// Rider books -> quote -> dispatch -> Driver accepts -> arrival -> RideCheck -> journey -> complete -> finance (disabled).
// Test environments only. Needs an already-seeded demo Driver (scripts/seed-demo-driver.mjs).
//
//   API_URL=https://... DEMO_DRIVER_ACCOUNT_ID=... DEMO_DRIVER_CONTACT_ID=... DEMO_VEHICLE_ID=... node scripts/demo-hosted-journey.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const API = (process.env.API_URL ?? '').replace(/\/$/, '');
const need = (name) => { const v = process.env[name]; if (!v) throw new Error(`${name} is required`); return v; };
if (!API) throw new Error('API_URL is required');
const driverAccountId = need('DEMO_DRIVER_ACCOUNT_ID');
const driverContactId = need('DEMO_DRIVER_CONTACT_ID');
const vehicleId = need('DEMO_VEHICLE_ID');

const run = randomUUID().slice(0, 8);
const steps = [];

async function call(method, path, token, body, key) {
  const headers = body === undefined ? {} : { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (key) headers['idempotency-key'] = `${key}-${run}`;
  const res = await fetch(`${API}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90_000) });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : undefined; } catch { json = { raw: text }; }
  return { status: res.status, json };
}
function ok(label, res, ...expected) {
  const pass = expected.includes(res.status);
  steps.push({ step: label, status: res.status, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  (HTTP ${res.status})`);
  if (!pass) { console.log(JSON.stringify(res.json, null, 2)); throw new Error(`Step failed: ${label}`); }
  return res.json;
}
async function signIn(accountId, contactPointId, device) {
  const v = ok(`verify contact (${device})`, await call('POST', '/v1/identity/verifications/contact', undefined, { accountId, contactPointId }), 202);
  const c = ok(`confirm contact (${device})`, await call('POST', '/v1/identity/verifications/contact/confirm', undefined, {
    verificationId: v.verificationId, code: v.developmentCode, device: { deviceInstanceId: `${device}-${run}-device`, platform: 'DEMO' }
  }), 200);
  return c.session.bearerToken;
}

// Rider
const reg = ok('register Rider', await call('POST', '/v1/identity/registrations', undefined, {
  profileKind: 'RIDER', preferredName: 'Demo Rider', contact: { type: 'EMAIL', value: `demo.rider.${run}@example.com` }
}, 'rider-reg'), 202);
const riderToken = await signIn(reg.accountId, reg.contact.id, 'rider');
const driverToken = await signIn(driverAccountId, driverContactId, 'driver');

// Recovery: a previously interrupted demo run can leave the demo Driver mid-journey. Finish it safely first.
const ops = await call('GET', '/v1/driver/daily-operations', driverToken);
if (ops.status === 200 && ops.json.activeJourneyId) {
  const stuck = ops.json.activeJourneyId;
  console.log('INFO  Driver has an unfinished journey from an earlier run; completing it:', stuck);
  const loc = (lat, lon, ageMs) => ({ clientObservationId: randomUUID(), latitude: lat, longitude: lon, observedAt: new Date(Date.now() - ageMs).toISOString(), source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99 });
  await call('POST', `/v1/journeys/${stuck}/telemetry/location`, driverToken, loc(51.5074, -0.1241, 18_000));
  await call('POST', `/v1/journeys/${stuck}/telemetry/location`, driverToken, loc(51.5076, -0.1206, 0));
  ok('recovery: arriving', await call('POST', `/v1/journeys/${stuck}/arriving`, driverToken, undefined, 'rec-arriving'), 200);
  ok('recovery: complete', await call('POST', `/v1/journeys/${stuck}/complete`, driverToken, undefined, 'rec-complete'), 200);
}

// Driver goes available (eligibility is enforced server-side)
const availability = ok('Driver goes AVAILABLE', await call('PUT', '/v1/driver/availability', driverToken, {
  status: 'AVAILABLE', regionCode: 'GB-LON', vehicleId,
  location: { latitude: 51.5072, longitude: -0.1276, observedAt: new Date().toISOString(), source: 'DEVICE_GPS', confidence: 0.99 }
}, 'driver-available'), 200);
console.log('INFO  availability echo blockers:', JSON.stringify(availability.eligibility.blockers));

// Booking
const booking = ok('create booking', await call('POST', '/v1/bookings', riderToken, {
  regionCode: 'GB-LON',
  pickup: { latitude: 51.5072, longitude: -0.1276, displayLabel: 'Demo pickup' },
  dropoff: { latitude: 51.5076, longitude: -0.1206, displayLabel: 'Demo destination' }
}, 'create-booking'), 201);
const bookingId = booking.bookingId;
const quote = ok('quote (development fixture)', await call('POST', `/v1/bookings/${bookingId}/quote`, riderToken, undefined, 'quote'), 201);
ok('confirm quote', await call('POST', `/v1/bookings/${bookingId}/confirm`, riderToken, { quoteId: quote.quote.quoteId }, 'confirm'), 200);

// Dispatch + offer
const dispatch = ok('dispatch', await call('POST', `/v1/bookings/${bookingId}/dispatch`, riderToken, undefined, 'dispatch'), 200);
assert.equal(dispatch.dispatchStatus, 'OFFERING', `dispatch should be OFFERING, got ${dispatch.dispatchStatus}`);
const offers = ok('Driver sees offer', await call('GET', '/v1/driver/offers', driverToken), 200);
const offer = offers.offers.find((o) => o.bookingId === bookingId);
assert.ok(offer, 'Driver must see the offer for this booking');
ok('Driver accepts offer', await call('POST', `/v1/driver/offers/${offer.offerId}/accept`, driverToken, undefined, 'accept'), 200);
const riderAssigned = ok('Rider progress (assigned)', await call('GET', `/v1/bookings/${bookingId}/core-journey-progress`, riderToken), 200);
const driverAssigned = ok('Driver progress (assigned)', await call('GET', `/v1/driver/bookings/${bookingId}/core-journey-progress`, driverToken), 200);
assert.deepEqual(riderAssigned, driverAssigned, 'Rider and Driver must see the same canonical journey');

// Pickup, RideCheck, journey
const ack = ok('Driver acknowledges', await call('POST', `/v1/bookings/${bookingId}/journey/acknowledge`, driverToken, undefined, 'ack'), 200);
const journeyId = ack.journeyId;
ok('fresh pickup location', await call('POST', `/v1/journeys/${journeyId}/location-observations`, driverToken, {
  clientObservationId: randomUUID(), latitude: 51.5072, longitude: -0.1276, observedAt: new Date(Date.now() - 35_000).toISOString(),
  source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99
}), 202);
ok('Driver arrived', await call('POST', `/v1/journeys/${journeyId}/arrived`, driverToken, undefined, 'arrived'), 200);
const rc = ok('RideCheck started (Rider)', await call('POST', `/v1/journeys/${journeyId}/ridecheck/start`, riderToken, undefined, 'rc-start'), 201);
ok('RideCheck verified (Driver)', await call('POST', `/v1/journeys/${journeyId}/ridecheck/verify`, driverToken, { rideCheckSessionId: rc.rideCheckSessionId, code: rc.challengeCode }, 'rc-ok'), 200);
ok('journey started', await call('POST', `/v1/journeys/${journeyId}/start`, driverToken, undefined, 'start'), 200);
ok('route telemetry', await call('POST', `/v1/journeys/${journeyId}/telemetry/location`, driverToken, {
  clientObservationId: randomUUID(), latitude: 51.5074, longitude: -0.1241, observedAt: new Date(Date.now() - 18_000).toISOString(), source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99
}), 202);
ok('destination telemetry', await call('POST', `/v1/journeys/${journeyId}/telemetry/location`, driverToken, {
  clientObservationId: randomUUID(), latitude: 51.5076, longitude: -0.1206, observedAt: new Date().toISOString(), source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99
}), 202);
ok('arriving at destination', await call('POST', `/v1/journeys/${journeyId}/arriving`, driverToken, undefined, 'arriving'), 200);
const done = ok('journey completed', await call('POST', `/v1/journeys/${journeyId}/complete`, driverToken, undefined, 'complete'), 200);
assert.equal(done.paymentInitiated, false);

// Finance stays provider-disabled
const progress = ok('final Rider progress', await call('GET', `/v1/bookings/${bookingId}/core-journey-progress`, riderToken), 200);
assert.equal(progress.productionChargingEnabled, false);
const pay = ok('prepare payment intent (test only)', await call('POST', `/v1/bookings/${bookingId}/payment-intents`, riderToken, undefined, 'pay'), 201);
assert.equal(pay.chargingEligibility, 'NOT_ELIGIBLE');
assert.equal(pay.providerActionAttempted, false);
assert.equal(pay.productionChargingEnabled, false);
ok('receipt correctly NOT available (no captured payment)', await call('GET', `/v1/receipts/${bookingId}`, riderToken), 409);
const earnings = await call('GET', '/v1/driver/earnings', driverToken);
console.log(`INFO  Driver earnings endpoint HTTP ${earnings.status}`);

console.log(JSON.stringify({ result: 'ALL_STEPS_PASSED', bookingId, journeyId, finalPhase: progress.bookingStatus, nextAction: progress.nextAction, productionChargingEnabled: progress.productionChargingEnabled, riderEmail: `demo.rider.${run}@example.com` }, null, 2));
