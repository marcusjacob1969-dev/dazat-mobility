import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApi } from '../../services/api/dist/app.js';
import { loadConfig } from '../../services/api/dist/config.js';

const config = loadConfig({ DATABASE_URL: 'postgresql://route.invalid/dazat', REDIS_URL: 'redis://route.invalid', CONTACT_VERIFICATION_PEPPER: 'route-contact-pepper-at-least-32-characters', RIDECHECK_PEPPER: 'route-ridecheck-pepper-at-least-32-characters', VERIFICATION_DELIVERY_MODE: 'disabled', LOG_LEVEL: 'silent' });
const sessionRow = { session_id: 'session-1', session_status: 'ACTIVE', auth_strength: 'VERIFIED_CONTACT', expires_at: new Date(Date.now() + 60_000), account_id: 'account-1', account_status: 'ACTIVE', person_id: 'person-1', rider_profile_id: 'rider-1', driver_profile_id: 'driver-1' };
const progressRow = { booking_id: '10000000-0000-4000-8000-000000000001', booking_status: 'CONFIRMED', fare_agreement_id: null, dispatch_status: 'SEARCHING', assignment_id: null, journey_id: null, journey_status: null, arrival_accepted: null, ridecheck_status: null, payment_intent_status: null };

function databaseDouble(progressVisible = true) {
  const queries = [];
  return { queries, database: { query: async (sql) => { queries.push(sql); if (sql.includes('FROM identity.session')) return { rowCount: 1, rows: [sessionRow] }; if (sql.startsWith('UPDATE identity.session')) return { rowCount: 1, rows: [] }; if (sql.includes('FROM booking.booking b')) return { rowCount: progressVisible ? 1 : 0, rows: progressVisible ? [progressRow] : [] }; throw new Error('unexpected query'); }, end: async () => {} } };
}

for (const [name, path] of [['Rider', `/v1/bookings/${progressRow.booking_id}/core-journey-progress`], ['Driver', `/v1/driver/bookings/${progressRow.booking_id}/core-journey-progress`]]) {
  test(`${name} route returns the canonical no-store progress contract`, async () => {
    const dependency = databaseDouble(); const app = buildApi(config, { database: dependency.database });
    const response = await app.inject({ method: 'GET', url: path, headers: { authorization: `Bearer dzs_${'a'.repeat(40)}` } });
    assert.equal(response.statusCode, 200); assert.equal(response.json().nextAction, 'FARE_AGREEMENT'); assert.equal(response.json().productionChargingEnabled, false); assert.equal(response.headers['cache-control'], 'no-store');
    await app.close();
  });
}

test('route returns the same 404 for absent and unauthorized progress', async () => {
  const dependency = databaseDouble(false); const app = buildApi(config, { database: dependency.database });
  const response = await app.inject({ method: 'GET', url: `/v1/bookings/${progressRow.booking_id}/core-journey-progress`, headers: { authorization: `Bearer dzs_${'b'.repeat(40)}` } });
  assert.equal(response.statusCode, 404); assert.deepEqual(response.json(), { code: 'CORE_JOURNEY_NOT_FOUND' }); await app.close();
});
