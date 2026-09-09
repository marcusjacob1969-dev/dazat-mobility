import assert from 'node:assert/strict';
import test from 'node:test';
import { getControlRoomCoreJourneyProgress, getCoreJourneyProgress, getDriverCoreJourneyProgress } from '../../services/api/dist/modules/core-journey/core-journey-service.js';

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

test('progress retains the latest assignment after governed completion ends it', async () => {
  let capturedSql = '';
  const pool = { query: async (sql) => { capturedSql = sql; return { rowCount: 1, rows: [projectionRow] }; } };
  await getCoreJourneyProgress(pool, projectionRow.booking_id, actor);
  assert.match(capturedSql, /LEFT JOIN LATERAL \(SELECT id FROM dispatch\.driver_assignment/);
  assert.match(capturedSql, /ORDER BY assigned_at DESC LIMIT 1/);
  assert.doesNotMatch(capturedSql, /assignment\.status = 'ACTIVE'/);
});

test('unauthorised Rider and Driver reads are indistinguishable from absent Bookings', async () => {
  const pool = { query: async () => ({ rowCount: 0, rows: [] }) };
  await assert.rejects(getCoreJourneyProgress(pool, projectionRow.booking_id, actor), { name: 'Error', message: 'Journey progress is unavailable' });
  await assert.rejects(getDriverCoreJourneyProgress(pool, projectionRow.booking_id, actor), { name: 'Error', message: 'Journey progress is unavailable' });
});

test('Driver projection fails closed before querying when the session has no Driver profile', () => {
  let queryAttempted = false;
  const pool = { query: async () => { queryAttempted = true; return { rowCount: 1, rows: [projectionRow] }; } };
  assert.throws(() => getDriverCoreJourneyProgress(pool, projectionRow.booking_id, { ...actor, driverProfileId: undefined }), { message: 'Driver progress is unavailable' });
  assert.equal(queryAttempted, false);
});

test('Control Room progress is bound to a current purpose-scoped fatigue handover task', async () => {
  let captured;
  const handoverId = '20000000-0000-4000-8000-000000000001';
  const pool = { query: async (sql, parameters) => { captured = { sql, parameters }; return { rowCount: 1, rows: [projectionRow] }; } };
  await getControlRoomCoreJourneyProgress(pool, projectionRow.booking_id, handoverId, actor);
  assert.deepEqual(captured.parameters, [projectionRow.booking_id, actor.personId, handoverId]);
  assert.match(captured.sql, /control_room_task_scope task/);
  assert.match(captured.sql, /task\.valid_until > now\(\)/);
  assert.match(captured.sql, /scoped_journey\.booking_id = b\.id/);
});
