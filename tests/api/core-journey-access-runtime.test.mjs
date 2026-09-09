import assert from 'node:assert/strict';
import test from 'node:test';
import { getCoreJourneyProgress, getDriverCoreJourneyProgress } from '../../services/api/dist/modules/core-journey/core-journey-service.js';

const projectionRow = { booking_id: '10000000-0000-4000-8000-000000000001', booking_status: 'CONFIRMED', fare_agreement_id: null, dispatch_status: null, assignment_id: null, journey_id: null, journey_status: null, arrival_accepted: null, ridecheck_status: null, payment_intent_status: null };
const actor = { accountId: 'a', personId: 'person-1', accountStatus: 'ACTIVE', sessionId: 's', authStrength: 'VERIFIED_CONTACT', expiresAt: new Date(), riderProfileId: 'rider-1', driverProfileId: 'driver-1' };

test('Rider progress query scopes access to an authorised Booking party', async () => {
  let captured;
  const pool = { query: async (sql, parameters) => { captured = { sql, parameters }; return { rowCount: 1, rows: [projectionRow] }; } };
  const result = await getCoreJourneyProgress(pool, projectionRow.booking_id, actor);
  assert.deepEqual(captured.parameters, [projectionRow.booking_id, actor.personId]);
  assert.match(captured.sql, /booking\.booking_party/);
  assert.match(captured.sql, /BOOKER','PASSENGER','PAYER/);
  assert.equal(result.productionChargingEnabled, false);
});

test('Driver progress query scopes access to DriverAssignment rather than Booking party', async () => {
  let captured;
  const pool = { query: async (sql, parameters) => { captured = { sql, parameters }; return { rowCount: 1, rows: [projectionRow] }; } };
  await getDriverCoreJourneyProgress(pool, projectionRow.booking_id, actor);
  assert.deepEqual(captured.parameters, [projectionRow.booking_id, actor.driverProfileId]);
  assert.match(captured.sql, /dispatch\.driver_assignment permitted_assignment/);
  assert.doesNotMatch(captured.sql, /party\.person_id/);
});
