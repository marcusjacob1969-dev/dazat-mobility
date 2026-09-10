import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildApi } from '../services/api/dist/app.js';
import { loadConfig } from '../services/api/dist/config.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.DAZAT_MIGRATION_VALIDATION_TARGET !== 'ephemeral') {
  throw new Error('Core-journey HTTP PostgreSQL verification requires the explicitly ephemeral migration target');
}

const ids = {
  actorPerson: '70000000-0000-4000-8000-000000000001', actorAccount: '70000000-0000-4000-8000-000000000002',
  riderProfile: '70000000-0000-4000-8000-000000000003', driverProfile: '70000000-0000-4000-8000-000000000004',
  operatorPerson: '70000000-0000-4000-8000-000000000005', operatorAccount: '70000000-0000-4000-8000-000000000006',
  outsiderPerson: '70000000-0000-4000-8000-000000000007', outsiderAccount: '70000000-0000-4000-8000-000000000008',
  outsiderRider: '70000000-0000-4000-8000-000000000009', pickup: '70000000-0000-4000-8000-000000000010',
  dropoff: '70000000-0000-4000-8000-000000000011', incidentBooking: '70000000-0000-4000-8000-000000000012',
  completedBooking: '70000000-0000-4000-8000-000000000013', cancelledBooking: '70000000-0000-4000-8000-000000000014',
  privateBooking: '70000000-0000-4000-8000-000000000015', vehicle: '70000000-0000-4000-8000-000000000016',
  incidentAttempt: '70000000-0000-4000-8000-000000000017', completedAttempt: '70000000-0000-4000-8000-000000000018',
  incidentCandidate: '70000000-0000-4000-8000-000000000019', completedCandidate: '70000000-0000-4000-8000-000000000020',
  incidentOffer: '70000000-0000-4000-8000-000000000021', completedOffer: '70000000-0000-4000-8000-000000000022',
  incidentAssignment: '70000000-0000-4000-8000-000000000023', completedAssignment: '70000000-0000-4000-8000-000000000024',
  incidentJourney: '70000000-0000-4000-8000-000000000025', completedJourney: '70000000-0000-4000-8000-000000000026',
  incidentLeg: '70000000-0000-4000-8000-000000000027', completedLeg: '70000000-0000-4000-8000-000000000028',
  incidentLocation: '70000000-0000-4000-8000-000000000029', completedLocation: '70000000-0000-4000-8000-000000000030',
  incidentArrival: '70000000-0000-4000-8000-000000000031', completedArrival: '70000000-0000-4000-8000-000000000032',
  incidentRidecheck: '70000000-0000-4000-8000-000000000033', completedRidecheck: '70000000-0000-4000-8000-000000000034',
  incidentQuote: '70000000-0000-4000-8000-000000000035', completedQuote: '70000000-0000-4000-8000-000000000036',
  incidentFare: '70000000-0000-4000-8000-000000000037', completedFare: '70000000-0000-4000-8000-000000000038',
  incidentPayment: '70000000-0000-4000-8000-000000000039', completedPayment: '70000000-0000-4000-8000-000000000040',
  shift: '70000000-0000-4000-8000-000000000041', fatigue: '70000000-0000-4000-8000-000000000042',
  hold: '70000000-0000-4000-8000-000000000043', support: '70000000-0000-4000-8000-000000000044',
  handover: '70000000-0000-4000-8000-000000000045', role: '70000000-0000-4000-8000-000000000046',
  task: '70000000-0000-4000-8000-000000000047',
  dispatchVehicle: '70000000-0000-4000-8000-000000000048',
  dispatchAuthorisation: '70000000-0000-4000-8000-000000000049',
  dispatchInsurance: '70000000-0000-4000-8000-000000000050',
  dispatchDriverSnapshot: '70000000-0000-4000-8000-000000000051',
  dispatchVehicleSnapshot: '70000000-0000-4000-8000-000000000052',
  dispatchPermission: '70000000-0000-4000-8000-000000000053',
  maintenancePlan: '70000000-0000-4000-8000-000000000054',
  maintenancePlanVersion: '70000000-0000-4000-8000-000000000055',
  maintenanceRequirement: '70000000-0000-4000-8000-000000000056',
  maintenanceEvaluation: '70000000-0000-4000-8000-000000000057'
};

const tokens = {
  actor: `dzs_${randomBytes(32).toString('base64url')}`,
  operator: `dzs_${randomBytes(32).toString('base64url')}`,
  outsider: `dzs_${randomBytes(32).toString('base64url')}`,
  expired: `dzs_${randomBytes(32).toString('base64url')}`
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const pool = new pg.Pool({ connectionString, max: 1 });
const client = await pool.connect();
let savepointCounter = 0;
const database = {
  query: (...args) => client.query(...args),
  connect: async () => {
    const savepoint = `phase_071_command_${++savepointCounter}`;
    let active = false;
    return {
      query: (text, values) => {
        const command = typeof text === 'string' ? text.trim().toUpperCase() : '';
        if (command === 'BEGIN') { active = true; return client.query(`SAVEPOINT ${savepoint}`); }
        if (command === 'COMMIT') { active = false; return client.query(`RELEASE SAVEPOINT ${savepoint}`); }
        if (command === 'ROLLBACK') {
          if (!active) return Promise.resolve({ rows: [], rowCount: 0 });
          active = false;
          return client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).then(() => client.query(`RELEASE SAVEPOINT ${savepoint}`));
        }
        return client.query(text, values);
      },
      release: () => {}
    };
  },
  end: async () => {}
};
let app;

function auth(token) { return { authorization: `Bearer ${token}` }; }
async function get(path, token) {
  return app.inject({ method: 'GET', url: path, ...(token ? { headers: auth(token) } : {}) });
}
async function post(path, token, body, idempotencyKey) {
  return app.inject({
    method: 'POST', url: path,
    headers: { ...auth(token), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { payload: body })
  });
}
async function put(path, token, body, idempotencyKey) {
  return app.inject({
    method: 'PUT', url: path,
    headers: { ...auth(token), 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
    payload: body
  });
}
async function del(path, token) {
  return app.inject({ method: 'DELETE', url: path, headers: auth(token) });
}
function expectCode(response, statusCode, code) {
  assert.equal(response.statusCode, statusCode, response.body);
  if (code) assert.equal(response.json().code, code);
}

try {
  await client.query('BEGIN');
  await client.query(`
    INSERT INTO identity.person (id) VALUES
      ('${ids.actorPerson}'), ('${ids.operatorPerson}'), ('${ids.outsiderPerson}');
    INSERT INTO identity.user_account (id, person_id, status) VALUES
      ('${ids.actorAccount}', '${ids.actorPerson}', 'ACTIVE'),
      ('${ids.operatorAccount}', '${ids.operatorPerson}', 'ACTIVE'),
      ('${ids.outsiderAccount}', '${ids.outsiderPerson}', 'ACTIVE');
    INSERT INTO rider.rider_profile (id, person_id) VALUES
      ('${ids.riderProfile}', '${ids.actorPerson}'), ('${ids.outsiderRider}', '${ids.outsiderPerson}');
    INSERT INTO driver.driver_profile (id, person_id, onboarding_status, operating_status)
      VALUES ('${ids.driverProfile}', '${ids.actorPerson}', 'APPROVED', 'ONLINE');
    INSERT INTO identity.session (user_account_id, status, auth_strength, session_token_hash, issued_at, expires_at) VALUES
      ('${ids.actorAccount}', 'ACTIVE', 'VERIFIED_CONTACT', '${hash(tokens.actor)}', now(), now() + interval '1 hour'),
      ('${ids.operatorAccount}', 'ACTIVE', 'VERIFIED_CONTACT', '${hash(tokens.operator)}', now(), now() + interval '1 hour'),
      ('${ids.outsiderAccount}', 'ACTIVE', 'VERIFIED_CONTACT', '${hash(tokens.outsider)}', now(), now() + interval '1 hour'),
      ('${ids.actorAccount}', 'ACTIVE', 'VERIFIED_CONTACT', '${hash(tokens.expired)}', now() - interval '2 hours', now() - interval '1 hour');
    INSERT INTO booking.location_snapshot (id, point, display_label) VALUES
      ('${ids.pickup}', ST_SetSRID(ST_MakePoint(-0.1276, 51.5072), 4326)::geography, 'Phase 0.70 pickup'),
      ('${ids.dropoff}', ST_SetSRID(ST_MakePoint(-0.0877, 51.5074), 4326)::geography, 'Phase 0.70 dropoff');
    INSERT INTO booking.booking (id, status, pickup_snapshot_id, dropoff_snapshot_id, region_code) VALUES
      ('${ids.incidentBooking}', 'ACTIVE_INCIDENT', '${ids.pickup}', '${ids.dropoff}', 'GB-LON'),
      ('${ids.completedBooking}', 'COMPLETED', '${ids.pickup}', '${ids.dropoff}', 'GB-LON'),
      ('${ids.cancelledBooking}', 'RIDER_CANCELLED', '${ids.pickup}', '${ids.dropoff}', 'GB-LON'),
      ('${ids.privateBooking}', 'CONFIRMED', '${ids.pickup}', '${ids.dropoff}', 'GB-LON');
    INSERT INTO booking.booking_party (booking_id, role, person_id) VALUES
      ('${ids.incidentBooking}', 'BOOKER', '${ids.actorPerson}'),
      ('${ids.completedBooking}', 'BOOKER', '${ids.actorPerson}'),
      ('${ids.cancelledBooking}', 'BOOKER', '${ids.actorPerson}'),
      ('${ids.privateBooking}', 'BOOKER', '${ids.outsiderPerson}');
    INSERT INTO pricing.quote (id, booking_id, status, amount_minor, currency, policy_version, source_mode, expires_at, accepted_at) VALUES
      ('${ids.incidentQuote}', '${ids.incidentBooking}', 'ACCEPTED', 2500, 'GBP', 'phase-0.70', 'CI_FIXTURE', now() + interval '1 hour', now()),
      ('${ids.completedQuote}', '${ids.completedBooking}', 'ACCEPTED', 3200, 'GBP', 'phase-0.70', 'CI_FIXTURE', now() + interval '1 hour', now());
    INSERT INTO pricing.fare_agreement (id, booking_id, quote_id, amount_minor, currency, policy_version) VALUES
      ('${ids.incidentFare}', '${ids.incidentBooking}', '${ids.incidentQuote}', 2500, 'GBP', 'phase-0.70'),
      ('${ids.completedFare}', '${ids.completedBooking}', '${ids.completedQuote}', 3200, 'GBP', 'phase-0.70');
    INSERT INTO vehicle_fleet.vehicle (id, registration_mark, lifecycle_status) VALUES ('${ids.vehicle}', 'DZ70 CI', 'ACTIVE');
    INSERT INTO dispatch.dispatch_attempt (id, booking_id, booking_aggregate_version, status, region_code, policy_version, attempt_number, completed_at) VALUES
      ('${ids.incidentAttempt}', '${ids.incidentBooking}', 1, 'ASSIGNED', 'GB-LON', 'phase-0.70', 1, now()),
      ('${ids.completedAttempt}', '${ids.completedBooking}', 1, 'ASSIGNED', 'GB-LON', 'phase-0.70', 1, now());
    INSERT INTO dispatch.candidate_snapshot (id, dispatch_attempt_id, driver_profile_id, vehicle_id, driver_eligibility_snapshot_id, vehicle_eligibility_snapshot_id, availability_version, rank_position) VALUES
      ('${ids.incidentCandidate}', '${ids.incidentAttempt}', '${ids.driverProfile}', '${ids.vehicle}', gen_random_uuid(), gen_random_uuid(), 1, 1),
      ('${ids.completedCandidate}', '${ids.completedAttempt}', '${ids.driverProfile}', '${ids.vehicle}', gen_random_uuid(), gen_random_uuid(), 2, 1);
    INSERT INTO dispatch.driver_offer (id, dispatch_attempt_id, candidate_snapshot_id, booking_id, driver_profile_id, vehicle_id, status, meaningful_offer_payload, expires_at, responded_at) VALUES
      ('${ids.incidentOffer}', '${ids.incidentAttempt}', '${ids.incidentCandidate}', '${ids.incidentBooking}', '${ids.driverProfile}', '${ids.vehicle}', 'ACCEPTED', '{}', now() + interval '1 hour', now()),
      ('${ids.completedOffer}', '${ids.completedAttempt}', '${ids.completedCandidate}', '${ids.completedBooking}', '${ids.driverProfile}', '${ids.vehicle}', 'ACCEPTED', '{}', now() + interval '1 hour', now());
    INSERT INTO dispatch.driver_assignment (id, dispatch_attempt_id, accepted_offer_id, booking_id, driver_profile_id, vehicle_id, status, ended_at, end_reason) VALUES
      ('${ids.incidentAssignment}', '${ids.incidentAttempt}', '${ids.incidentOffer}', '${ids.incidentBooking}', '${ids.driverProfile}', '${ids.vehicle}', 'ACTIVE', null, null),
      ('${ids.completedAssignment}', '${ids.completedAttempt}', '${ids.completedOffer}', '${ids.completedBooking}', '${ids.driverProfile}', '${ids.vehicle}', 'COMPLETED', now(), 'JOURNEY_COMPLETED');
    INSERT INTO journey.journey (id, booking_id, active_assignment_id, status, started_at) VALUES
      ('${ids.incidentJourney}', '${ids.incidentBooking}', '${ids.incidentAssignment}', 'IN_PROGRESS', now()),
      ('${ids.completedJourney}', '${ids.completedBooking}', '${ids.completedAssignment}', 'COMPLETED', now() - interval '30 minutes');
    INSERT INTO journey.journey_leg (id, journey_id, sequence_number, driver_assignment_id, status, started_at, ended_at) VALUES
      ('${ids.incidentLeg}', '${ids.incidentJourney}', 1, '${ids.incidentAssignment}', 'IN_PROGRESS', now(), null),
      ('${ids.completedLeg}', '${ids.completedJourney}', 1, '${ids.completedAssignment}', 'COMPLETED', now() - interval '30 minutes', now());
    INSERT INTO journey.driver_location_observation (id, journey_id, journey_leg_id, driver_profile_id, client_observation_id, point, observed_at, source, accuracy_metres, confidence, telemetry_state, usable_for_critical_decision) VALUES
      ('${ids.incidentLocation}', '${ids.incidentJourney}', '${ids.incidentLeg}', '${ids.driverProfile}', gen_random_uuid(), ST_SetSRID(ST_MakePoint(-0.1276, 51.5072),4326)::geography, now(), 'DEVICE_GPS', 5, 0.99, 'LIVE', true),
      ('${ids.completedLocation}', '${ids.completedJourney}', '${ids.completedLeg}', '${ids.driverProfile}', gen_random_uuid(), ST_SetSRID(ST_MakePoint(-0.1276, 51.5072),4326)::geography, now(), 'DEVICE_GPS', 5, 0.99, 'LIVE', true);
    INSERT INTO journey.arrival_evidence (id, journey_id, journey_leg_id, driver_location_observation_id, pickup_snapshot_id, distance_metres, permitted_radius_metres, accepted, policy_version) VALUES
      ('${ids.incidentArrival}', '${ids.incidentJourney}', '${ids.incidentLeg}', '${ids.incidentLocation}', '${ids.pickup}', 0, 200, true, 'phase-0.70'),
      ('${ids.completedArrival}', '${ids.completedJourney}', '${ids.completedLeg}', '${ids.completedLocation}', '${ids.pickup}', 0, 200, true, 'phase-0.70');
    INSERT INTO journey.ridecheck_session (id, journey_id, journey_leg_id, driver_assignment_id, passenger_person_id, driver_profile_id, vehicle_id, method, status, challenge_salt, challenge_verifier, maximum_attempts, expires_at, verified_at) VALUES
      ('${ids.incidentRidecheck}', '${ids.incidentJourney}', '${ids.incidentLeg}', '${ids.incidentAssignment}', '${ids.actorPerson}', '${ids.driverProfile}', '${ids.vehicle}', 'PIN', 'VERIFIED', 'ci-salt', 'ci-verifier', 5, now() + interval '1 hour', now()),
      ('${ids.completedRidecheck}', '${ids.completedJourney}', '${ids.completedLeg}', '${ids.completedAssignment}', '${ids.actorPerson}', '${ids.driverProfile}', '${ids.vehicle}', 'PIN', 'VERIFIED', 'ci-salt', 'ci-verifier', 5, now() + interval '1 hour', now());
    INSERT INTO finance.payment_intent (id, booking_id, fare_agreement_id, payer_person_id, amount_minor, currency, status, charging_eligibility) VALUES
      ('${ids.incidentPayment}', '${ids.incidentBooking}', '${ids.incidentFare}', '${ids.actorPerson}', 2500, 'GBP', 'CREATED', 'NOT_ELIGIBLE'),
      ('${ids.completedPayment}', '${ids.completedBooking}', '${ids.completedFare}', '${ids.actorPerson}', 3200, 'GBP', 'CAPTURED', 'APPROVED_POLICY');
    INSERT INTO driver.driver_shift_session (id, driver_profile_id, status, region_code, selected_vehicle_id, start_availability_version) VALUES
      ('${ids.shift}', '${ids.driverProfile}', 'ACTIVE', 'GB-LON', '${ids.vehicle}', 1);
    INSERT INTO driver.driver_fatigue_observation (id, driver_profile_id, driver_shift_session_id, observation_type, status, source_type, evidence_reference, observed_at) VALUES
      ('${ids.fatigue}', '${ids.driverProfile}', '${ids.shift}', 'DRIVER_REPORTED_FATIGUE', 'ACTIVE', 'DRIVER_SELF_REPORT', 'phase-0.70-fixture', now());
    INSERT INTO journey.operational_hold (id, journey_id, status, reason_code, source_type, source_id) VALUES
      ('${ids.hold}', '${ids.incidentJourney}', 'ACTIVE', 'DRIVER_FATIGUE', 'SAFETY', '${ids.fatigue}');
    INSERT INTO operations.driver_support_case (id, driver_profile_id, category, risk, status, journey_id, booking_id, vehicle_id, summary_reference, human_escalation_required, created_by_person_id) VALUES
      ('${ids.support}', '${ids.driverProfile}', 'SAFETY', 'HIGH_RISK_ACTIVE', 'HUMAN_ESCALATION_REQUIRED', '${ids.incidentJourney}', '${ids.incidentBooking}', '${ids.vehicle}', 'phase-0.70-fatigue', true, '${ids.actorPerson}');
    INSERT INTO operations.driver_fatigue_handover (id, fatigue_observation_id, operational_hold_id, support_case_id, journey_id, assignment_id, driver_profile_id, status) VALUES
      ('${ids.handover}', '${ids.fatigue}', '${ids.hold}', '${ids.support}', '${ids.incidentJourney}', '${ids.incidentAssignment}', '${ids.driverProfile}', 'REQUESTED');
    INSERT INTO operations.control_room_role_assignment (id, operator_person_id, role_code, valid_from, valid_until, assigned_by_person_id, evidence_reference) VALUES
      ('${ids.role}', '${ids.operatorPerson}', 'FATIGUE_HANDOVER_OPERATOR', now() - interval '1 minute', now() + interval '1 hour', '${ids.operatorPerson}', 'phase-0.70-role');
    INSERT INTO operations.control_room_task_scope (id, operator_person_id, role_assignment_id, purpose, subject_type, subject_id, valid_from, valid_until) VALUES
      ('${ids.task}', '${ids.operatorPerson}', '${ids.role}', 'DRIVER_FATIGUE_HANDOVER', 'DRIVER_FATIGUE_HANDOVER', '${ids.handover}', now() - interval '1 minute', now() + interval '1 hour');
  `);

  const config = loadConfig({
    DATABASE_URL: connectionString, REDIS_URL: 'redis://disabled.invalid:6379', LOG_LEVEL: 'silent',
    CONTACT_VERIFICATION_PEPPER: 'phase-070-contact-verification-pepper', RIDECHECK_PEPPER: 'phase-070-ridecheck-verifier-pepper',
    VERIFICATION_DELIVERY_MODE: 'development_console', DAZAT_DEV_EXPOSE_VERIFICATION_CODE: 'true',
    PRICING_MODE: 'development_fixture', DEVELOPMENT_QUOTE_AMOUNT_MINOR: '1800', DEVELOPMENT_QUOTE_CURRENCY: 'GBP',
    DEVELOPMENT_DISPATCH_PICKUP_ETA_MINUTES: '8', DEVELOPMENT_DRIVER_EARNING_AMOUNT_MINOR: '1200',
    DEVELOPMENT_DRIVER_EARNING_CURRENCY: 'GBP'
  });
  app = buildApi(config, { database });
  await app.ready();

  const registrationInput = {
    profileKind: 'RIDER', preferredName: 'Phase 0.72 Rider',
    contact: { type: 'EMAIL', value: 'phase-072-rider@example.invalid' }
  };
  const registration = await post('/v1/identity/registrations', undefined, registrationInput, 'phase-072-register-rider');
  expectCode(registration, 202);
  assert.equal(registration.json().accountStatus, 'PENDING');
  const registrationReplay = await post('/v1/identity/registrations', undefined, registrationInput, 'phase-072-register-rider');
  expectCode(registrationReplay, 202);
  assert.deepEqual(registrationReplay.json(), registration.json());
  const verification = await post('/v1/identity/verifications/contact', undefined, {
    accountId: registration.json().accountId, contactPointId: registration.json().contact.id
  });
  expectCode(verification, 202);
  assert.equal(verification.json().deliveryState, 'DELIVERED');
  assert.match(verification.json().developmentCode, /^\d{6}$/);
  const authenticated = await post('/v1/identity/verifications/contact/confirm', undefined, {
    verificationId: verification.json().verificationId,
    code: verification.json().developmentCode,
    device: { deviceInstanceId: 'phase-072-ci-device', platform: 'CI' }
  });
  expectCode(authenticated, 200);
  assert.equal(authenticated.json().accountStatus, 'ACTIVE');
  const registeredToken = authenticated.json().session.bearerToken;
  const session = await get('/v1/identity/session', registeredToken);
  expectCode(session, 200);
  assert.equal(session.json().accountId, registration.json().accountId);
  assert.equal(session.json().riderProfileId, registration.json().riderProfileId);

  const createInput = {
    regionCode: 'GB-LON',
    pickup: { latitude: 51.5072, longitude: -0.1276, displayLabel: 'Phase 0.71 HTTP pickup' },
    dropoff: { latitude: 51.5074, longitude: -0.0877, displayLabel: 'Phase 0.71 HTTP destination' }
  };
  const created = await post('/v1/bookings', registeredToken, createInput, 'phase-071-create-booking');
  expectCode(created, 201);
  const createdBooking = created.json();
  assert.equal(createdBooking.status, 'DRAFT');
  const replayedCreate = await post('/v1/bookings', registeredToken, createInput, 'phase-071-create-booking');
  expectCode(replayedCreate, 201);
  assert.deepEqual(replayedCreate.json(), createdBooking);

  const quoted = await post(`/v1/bookings/${createdBooking.bookingId}/quote`, registeredToken, undefined, 'phase-071-create-quote');
  expectCode(quoted, 201);
  assert.equal(quoted.json().quote.amountMinor, 1800);
  assert.equal(quoted.json().quote.currency, 'GBP');
  const confirmed = await post(`/v1/bookings/${createdBooking.bookingId}/confirm`, registeredToken, { quoteId: quoted.json().quote.quoteId }, 'phase-071-confirm-booking');
  expectCode(confirmed, 200);
  assert.equal(confirmed.json().booking.status, 'READY_FOR_DISPATCH');
  const confirmedReplay = await post(`/v1/bookings/${createdBooking.bookingId}/confirm`, registeredToken, { quoteId: quoted.json().quote.quoteId }, 'phase-071-confirm-booking');
  expectCode(confirmedReplay, 200);
  assert.deepEqual(confirmedReplay.json(), confirmed.json());

  const createdProgress = await get(`/v1/bookings/${createdBooking.bookingId}/core-journey-progress`, registeredToken);
  expectCode(createdProgress, 200);
  assert.equal(createdProgress.json().bookingStatus, 'READY_FOR_DISPATCH');
  assert.equal(createdProgress.json().nextAction, 'DISPATCH');
  assert.equal(createdProgress.json().productionChargingEnabled, false);
  expectCode(await get(`/v1/bookings/${createdBooking.bookingId}/core-journey-progress`, tokens.outsider), 404, 'CORE_JOURNEY_NOT_FOUND');
  expectCode(await post('/v1/bookings', registeredToken, createInput), 400, 'IDEMPOTENCY_KEY_REQUIRED');

  const noDriverDispatch = await post(`/v1/bookings/${createdBooking.bookingId}/dispatch`, registeredToken, undefined, 'phase-073-start-dispatch');
  expectCode(noDriverDispatch, 200);
  assert.equal(noDriverDispatch.json().bookingStatus, 'NO_ELIGIBLE_DRIVER');
  assert.equal(noDriverDispatch.json().dispatchStatus, 'NO_ELIGIBLE_DRIVER');
  assert.equal(noDriverDispatch.json().eligibleCandidateCount, 0);
  assert.equal(noDriverDispatch.json().offeredDriverCount, 0);
  const noDriverReplay = await post(`/v1/bookings/${createdBooking.bookingId}/dispatch`, registeredToken, undefined, 'phase-073-start-dispatch');
  expectCode(noDriverReplay, 200);
  assert.deepEqual(noDriverReplay.json(), noDriverDispatch.json());
  const noDriverProgress = await get(`/v1/bookings/${createdBooking.bookingId}/core-journey-progress`, registeredToken);
  expectCode(noDriverProgress, 200);
  assert.equal(noDriverProgress.json().bookingStatus, 'NO_ELIGIBLE_DRIVER');
  assert.equal(noDriverProgress.json().disposition, 'SUPPORT_REQUIRED');
  assert.equal(noDriverProgress.json().nextAction, 'SUPPORT_REQUIRED');
  assert.equal(noDriverProgress.json().milestones.find((milestone) => milestone.name === 'DRIVER_ASSIGNED').status, 'BLOCKED');

  const driverRegistrationInput = {
    profileKind: 'DRIVER', preferredName: 'Phase 0.74 Driver',
    contact: { type: 'EMAIL', value: 'phase-074-driver@example.invalid' }
  };
  const driverRegistration = await post('/v1/identity/registrations', undefined, driverRegistrationInput, 'phase-074-register-driver');
  expectCode(driverRegistration, 202);
  const driverVerification = await post('/v1/identity/verifications/contact', undefined, {
    accountId: driverRegistration.json().accountId, contactPointId: driverRegistration.json().contact.id
  });
  expectCode(driverVerification, 202);
  const driverAuthenticated = await post('/v1/identity/verifications/contact/confirm', undefined, {
    verificationId: driverVerification.json().verificationId,
    code: driverVerification.json().developmentCode,
    device: { deviceInstanceId: 'phase-074-driver-ci-device', platform: 'CI' }
  });
  expectCode(driverAuthenticated, 200);
  const driverToken = driverAuthenticated.json().session.bearerToken;
  const liveDriverProfileId = driverRegistration.json().driverProfileId;
  await client.query(`UPDATE driver.driver_profile SET onboarding_status = 'APPROVED' WHERE id = $1`, [liveDriverProfileId]);
  await client.query(`INSERT INTO vehicle_fleet.vehicle (id, registration_mark, lifecycle_status) VALUES ($1, 'DZ74 CI', 'ACTIVE')`, [ids.dispatchVehicle]);
  await client.query(`INSERT INTO driver.driver_vehicle_authorisation (id, driver_profile_id, vehicle_id, status, valid_from, valid_until) VALUES ($1,$2,$3,'ACTIVE',now() - interval '1 hour',now() + interval '1 day')`, [ids.dispatchAuthorisation, liveDriverProfileId, ids.dispatchVehicle]);
  await client.query(`INSERT INTO compliance.driver_vehicle_insurance_validation (id, driver_profile_id, vehicle_id, status, insurer_reference, policy_reference, evidence_references, verification_authority, valid_until) VALUES ($1,$2,$3,'ELIGIBLE','phase-074-insurer','phase-074-policy','["phase-074-insurance"]','CI_VERIFIER',now() + interval '1 day')`, [ids.dispatchInsurance, liveDriverProfileId, ids.dispatchVehicle]);
  await client.query(`INSERT INTO compliance.driver_eligibility_snapshot (id, driver_profile_id, status, policy_version, evidence_references, valid_until) VALUES ($1,$2,'ELIGIBLE','phase-0.74','["phase-074-driver"]',now() + interval '1 day')`, [ids.dispatchDriverSnapshot, liveDriverProfileId]);
  await client.query(`INSERT INTO compliance.vehicle_eligibility_snapshot (id, vehicle_id, status, policy_version, service_capabilities, evidence_references, valid_until) VALUES ($1,$2,'ELIGIBLE','phase-0.74','{}','["phase-074-vehicle"]',now() + interval '1 day')`, [ids.dispatchVehicleSnapshot, ids.dispatchVehicle]);
  await client.query(`INSERT INTO driver.driver_permission (id, driver_profile_id, region_code, service_code, status, risk_tier, source_type, source_reference_id, policy_version, valid_from, valid_until) VALUES ($1,$2,'GB-LON','STANDARD','ACTIVE','STANDARD','COMPLIANCE_REVIEW',$3,'phase-0.74',now() - interval '1 hour',now() + interval '1 day')`, [ids.dispatchPermission, liveDriverProfileId, ids.dispatchDriverSnapshot]);
  await client.query(`INSERT INTO vehicle_fleet.vehicle_maintenance_plan (id, vehicle_id) VALUES ($1,$2)`, [ids.maintenancePlan, ids.dispatchVehicle]);
  await client.query(`INSERT INTO vehicle_fleet.vehicle_maintenance_plan_version (id, maintenance_plan_id, version, status, source_types, source_references, policy_version, effective_from, effective_until) VALUES ($1,$2,1,'ACTIVE',ARRAY['DAZAT_POLICY']::vehicle_fleet.maintenance_plan_source[],'["phase-074-plan"]','phase-0.74',now() - interval '1 hour',now() + interval '1 day')`, [ids.maintenancePlanVersion, ids.maintenancePlan]);
  await client.query(`INSERT INTO vehicle_fleet.maintenance_requirement (id, plan_version_id, requirement_code, description, source_type, source_reference, due_at, evidence_references) VALUES ($1,$2,'DAILY_CHECK','Daily operational check','DAZAT_POLICY','phase-0.74',now() + interval '1 day','["phase-074-requirement"]')`, [ids.maintenanceRequirement, ids.maintenancePlanVersion]);
  await client.query(`INSERT INTO vehicle_fleet.maintenance_requirement_evaluation (id, maintenance_requirement_id, status, urgency, evidence_references, evaluated_by_authority, policy_version) VALUES ($1,$2,'OPEN','ROUTINE','["phase-074-evaluation"]','CI_VERIFIER','phase-0.74')`, [ids.maintenanceEvaluation, ids.maintenanceRequirement]);

  const eligibilityBeforeOnline = await get(`/v1/driver/eligibility?regionCode=GB-LON&vehicleId=${ids.dispatchVehicle}`, driverToken);
  expectCode(eligibilityBeforeOnline, 200);
  assert.equal(eligibilityBeforeOnline.json().eligible, false);
  assert.ok(eligibilityBeforeOnline.json().blockers.includes('NOT_AVAILABLE'));
  const availability = await put('/v1/driver/availability', driverToken, {
    status: 'AVAILABLE', regionCode: 'GB-LON', vehicleId: ids.dispatchVehicle,
    location: { latitude: 51.5072, longitude: -0.1276, observedAt: new Date().toISOString(), source: 'DEVICE_GPS', confidence: 0.99 }
  }, 'phase-074-driver-available');
  expectCode(availability, 200);
  assert.equal(availability.json().status, 'AVAILABLE');
  assert.equal(availability.json().eligibility.eligible, true);

  const successfulCreated = await post('/v1/bookings', registeredToken, {
    ...createInput,
    pickup: { ...createInput.pickup, displayLabel: 'Phase 0.74 successful Dispatch pickup' }
  }, 'phase-074-create-booking');
  expectCode(successfulCreated, 201);
  const successfulQuote = await post(`/v1/bookings/${successfulCreated.json().bookingId}/quote`, registeredToken, undefined, 'phase-074-create-quote');
  expectCode(successfulQuote, 201);
  const successfulConfirm = await post(`/v1/bookings/${successfulCreated.json().bookingId}/confirm`, registeredToken, { quoteId: successfulQuote.json().quote.quoteId }, 'phase-074-confirm-booking');
  expectCode(successfulConfirm, 200);
  const successfulDispatch = await post(`/v1/bookings/${successfulCreated.json().bookingId}/dispatch`, registeredToken, undefined, 'phase-074-start-dispatch');
  expectCode(successfulDispatch, 200);
  assert.equal(successfulDispatch.json().dispatchStatus, 'OFFERING');
  assert.equal(successfulDispatch.json().eligibleCandidateCount, 1);
  assert.equal(successfulDispatch.json().offeredDriverCount, 1);
  const offers = await get('/v1/driver/offers', driverToken);
  expectCode(offers, 200);
  assert.equal(offers.json().offers.length, 1);
  const offer = offers.json().offers[0];
  assert.equal(offer.bookingId, successfulCreated.json().bookingId);
  assert.equal(offer.disclosure.informedChoiceReady, true);
  assert.equal(offer.disclosure.acceptanceAllowed, true);
  assert.deepEqual(offer.disclosure.missingDisclosures, []);
  assert.equal(offer.disclosure.pickupEta.minutes, 8);
  assert.equal(offer.disclosure.expectedEarning.amountMinor, 1200);
  const accepted = await post(`/v1/driver/offers/${offer.offerId}/accept`, driverToken, undefined, 'phase-074-accept-offer');
  expectCode(accepted, 200);
  assert.equal(accepted.json().bookingStatus, 'DRIVER_ASSIGNED');
  const acceptedReplay = await post(`/v1/driver/offers/${offer.offerId}/accept`, driverToken, undefined, 'phase-074-accept-offer');
  expectCode(acceptedReplay, 200);
  assert.deepEqual(acceptedReplay.json(), accepted.json());
  const riderAssignedProgress = await get(`/v1/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, registeredToken);
  const driverAssignedProgress = await get(`/v1/driver/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, driverToken);
  expectCode(riderAssignedProgress, 200);
  expectCode(driverAssignedProgress, 200);
  assert.equal(riderAssignedProgress.json().bookingStatus, 'DRIVER_ASSIGNED');
  assert.deepEqual(driverAssignedProgress.json(), riderAssignedProgress.json());
  assert.equal(riderAssignedProgress.json().milestones.find((milestone) => milestone.name === 'DRIVER_ASSIGNED').status, 'COMPLETED');
  assert.equal((await get('/v1/driver/offers', driverToken)).json().offers.length, 0);

  const acknowledged = await post(`/v1/bookings/${successfulCreated.json().bookingId}/journey/acknowledge`, driverToken, undefined, 'phase-075-acknowledge-assignment');
  expectCode(acknowledged, 200);
  assert.equal(acknowledged.json().bookingStatus, 'DRIVER_EN_ROUTE');
  assert.equal(acknowledged.json().journeyStatus, 'EN_ROUTE');
  const acknowledgedReplay = await post(`/v1/bookings/${successfulCreated.json().bookingId}/journey/acknowledge`, driverToken, undefined, 'phase-075-acknowledge-assignment');
  expectCode(acknowledgedReplay, 200);
  assert.deepEqual(acknowledgedReplay.json(), acknowledged.json());
  const pickupObservation = await post(`/v1/journeys/${acknowledged.json().journeyId}/location-observations`, driverToken, {
    clientObservationId: '70000000-0000-4000-8000-000000000058',
    latitude: 51.5072, longitude: -0.1276, observedAt: new Date(Date.now() - 40_000).toISOString(),
    source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99
  });
  expectCode(pickupObservation, 202);
  assert.equal(pickupObservation.json().telemetryState, 'DELAYED');
  assert.equal(pickupObservation.json().usableForCriticalDecision, true);
  const arrived = await post(`/v1/journeys/${acknowledged.json().journeyId}/arrived`, driverToken, undefined, 'phase-075-mark-arrived');
  expectCode(arrived, 200);
  assert.equal(arrived.json().bookingStatus, 'DRIVER_ARRIVED');
  assert.equal(arrived.json().journeyStatus, 'ARRIVED');
  assert.ok(arrived.json().distanceMetres <= arrived.json().arrivalRadiusMetres);
  const arrivedReplay = await post(`/v1/journeys/${acknowledged.json().journeyId}/arrived`, driverToken, undefined, 'phase-075-mark-arrived');
  expectCode(arrivedReplay, 200);
  assert.deepEqual(arrivedReplay.json(), arrived.json());
  const riderArrivedProgress = await get(`/v1/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, registeredToken);
  const driverArrivedProgress = await get(`/v1/driver/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, driverToken);
  expectCode(riderArrivedProgress, 200);
  expectCode(driverArrivedProgress, 200);
  assert.deepEqual(driverArrivedProgress.json(), riderArrivedProgress.json());
  assert.equal(riderArrivedProgress.json().bookingStatus, 'DRIVER_ARRIVED');
  assert.equal(riderArrivedProgress.json().journeyStatus, 'ARRIVED');
  assert.equal(riderArrivedProgress.json().milestones.find((milestone) => milestone.name === 'ARRIVAL').status, 'COMPLETED');

  const rideCheck = await post(`/v1/journeys/${acknowledged.json().journeyId}/ridecheck/start`, registeredToken, undefined, 'phase-076-start-ridecheck');
  expectCode(rideCheck, 201);
  assert.equal(rideCheck.json().bookingStatus, 'AWAITING_RIDECHECK');
  assert.match(rideCheck.json().challengeCode, /^\d{6}$/);
  assert.equal(rideCheck.json().challengeCodeReturnedOnce, true);
  const rideCheckReplay = await post(`/v1/journeys/${acknowledged.json().journeyId}/ridecheck/start`, registeredToken, undefined, 'phase-076-start-ridecheck');
  expectCode(rideCheckReplay, 201);
  assert.equal(rideCheckReplay.json().rideCheckSessionId, rideCheck.json().rideCheckSessionId);
  assert.equal(rideCheckReplay.json().challengeCodeReturnedOnce, false);
  assert.equal('challengeCode' in rideCheckReplay.json(), false);
  const rideCheckVerified = await post(`/v1/journeys/${acknowledged.json().journeyId}/ridecheck/verify`, driverToken, {
    rideCheckSessionId: rideCheck.json().rideCheckSessionId, code: rideCheck.json().challengeCode
  }, 'phase-076-verify-ridecheck');
  expectCode(rideCheckVerified, 200);
  assert.equal(rideCheckVerified.json().verified, true);
  assert.equal(rideCheckVerified.json().bookingStatus, 'PASSENGER_VERIFIED');
  const journeyStarted = await post(`/v1/journeys/${acknowledged.json().journeyId}/start`, driverToken, undefined, 'phase-076-start-journey');
  expectCode(journeyStarted, 200);
  assert.equal(journeyStarted.json().bookingStatus, 'IN_PROGRESS');
  assert.equal(journeyStarted.json().journeyStatus, 'IN_PROGRESS');
  const journeyStartedReplay = await post(`/v1/journeys/${acknowledged.json().journeyId}/start`, driverToken, undefined, 'phase-076-start-journey');
  expectCode(journeyStartedReplay, 200);
  assert.deepEqual(journeyStartedReplay.json(), journeyStarted.json());
  const riderInProgress = await get(`/v1/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, registeredToken);
  const driverInProgress = await get(`/v1/driver/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, driverToken);
  expectCode(riderInProgress, 200);
  expectCode(driverInProgress, 200);
  assert.deepEqual(driverInProgress.json(), riderInProgress.json());
  assert.equal(riderInProgress.json().bookingStatus, 'IN_PROGRESS');
  assert.equal(riderInProgress.json().milestones.find((milestone) => milestone.name === 'RIDECHECK').status, 'COMPLETED');
  assert.equal(riderInProgress.json().milestones.find((milestone) => milestone.name === 'JOURNEY').status, 'IN_PROGRESS');

  const routeTelemetry = await post(`/v1/journeys/${acknowledged.json().journeyId}/telemetry/location`, driverToken, {
    clientObservationId: '70000000-0000-4000-8000-000000000059',
    latitude: 51.5073, longitude: -0.10765, observedAt: new Date(Date.now() - 20_000).toISOString(),
    source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99
  });
  expectCode(routeTelemetry, 202);
  assert.equal(routeTelemetry.json().movementPlausible, true);
  const destinationTelemetry = await post(`/v1/journeys/${acknowledged.json().journeyId}/telemetry/location`, driverToken, {
    clientObservationId: '70000000-0000-4000-8000-000000000060',
    latitude: 51.5074, longitude: -0.0877, observedAt: new Date().toISOString(),
    source: 'DEVICE_GPS', accuracyMetres: 5, confidence: 0.99
  });
  expectCode(destinationTelemetry, 202);
  assert.equal(destinationTelemetry.json().telemetryState, 'LIVE');
  assert.equal(destinationTelemetry.json().usableForMonitoring, true);
  assert.equal(destinationTelemetry.json().movementPlausible, true);
  const arriving = await post(`/v1/journeys/${acknowledged.json().journeyId}/arriving`, driverToken, undefined, 'phase-077-mark-arriving');
  expectCode(arriving, 200);
  assert.equal(arriving.json().bookingStatus, 'ARRIVING');
  assert.equal(arriving.json().journeyStatus, 'ARRIVING');
  const arrivingReplay = await post(`/v1/journeys/${acknowledged.json().journeyId}/arriving`, driverToken, undefined, 'phase-077-mark-arriving');
  expectCode(arrivingReplay, 200);
  assert.deepEqual(arrivingReplay.json(), arriving.json());
  const completedLiveJourney = await post(`/v1/journeys/${acknowledged.json().journeyId}/complete`, driverToken, undefined, 'phase-077-complete-journey');
  expectCode(completedLiveJourney, 200);
  assert.equal(completedLiveJourney.json().bookingStatus, 'COMPLETED');
  assert.equal(completedLiveJourney.json().journeyStatus, 'COMPLETED');
  assert.equal(completedLiveJourney.json().assignmentStatus, 'COMPLETED');
  assert.equal(completedLiveJourney.json().driverAvailability, 'AVAILABLE');
  assert.equal(completedLiveJourney.json().paymentInitiated, false);
  const completedLiveJourneyReplay = await post(`/v1/journeys/${acknowledged.json().journeyId}/complete`, driverToken, undefined, 'phase-077-complete-journey');
  expectCode(completedLiveJourneyReplay, 200);
  assert.deepEqual(completedLiveJourneyReplay.json(), completedLiveJourney.json());
  const riderCompletedProgress = await get(`/v1/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, registeredToken);
  const driverCompletedProgress = await get(`/v1/driver/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, driverToken);
  expectCode(riderCompletedProgress, 200);
  expectCode(driverCompletedProgress, 200);
  assert.deepEqual(driverCompletedProgress.json(), riderCompletedProgress.json());
  assert.equal(riderCompletedProgress.json().bookingStatus, 'COMPLETED');
  assert.equal(riderCompletedProgress.json().journeyStatus, 'COMPLETED');
  assert.equal(riderCompletedProgress.json().productionChargingEnabled, false);
  assert.equal(riderCompletedProgress.json().nextAction, 'FINANCE');
  assert.equal(riderCompletedProgress.json().milestones.find((milestone) => milestone.name === 'JOURNEY').status, 'COMPLETED');
  const releasedAvailability = await get(`/v1/driver/eligibility?regionCode=GB-LON&vehicleId=${ids.dispatchVehicle}`, driverToken);
  expectCode(releasedAvailability, 200);
  assert.equal(releasedAvailability.json().eligible, true);

  const preparedPayment = await post(`/v1/bookings/${successfulCreated.json().bookingId}/payment-intents`, registeredToken, undefined, 'phase-078-prepare-payment');
  expectCode(preparedPayment, 201);
  assert.equal(preparedPayment.json().amountMinor, 1800);
  assert.equal(preparedPayment.json().currency, 'GBP');
  assert.equal(preparedPayment.json().status, 'CREATED');
  assert.equal(preparedPayment.json().chargingEligibility, 'NOT_ELIGIBLE');
  assert.equal(preparedPayment.json().providerActionAttempted, false);
  assert.equal(preparedPayment.json().productionChargingEnabled, false);
  assert.equal(preparedPayment.json().blindRetryAllowed, false);
  const preparedPaymentReplay = await post(`/v1/bookings/${successfulCreated.json().bookingId}/payment-intents`, registeredToken, undefined, 'phase-078-prepare-payment');
  expectCode(preparedPaymentReplay, 201);
  assert.deepEqual(preparedPaymentReplay.json(), preparedPayment.json());
  const paymentStatus = await get(`/v1/payments/${preparedPayment.json().paymentIntentId}/status`, registeredToken);
  expectCode(paymentStatus, 200);
  assert.equal(paymentStatus.json().status, 'CREATED');
  assert.equal(paymentStatus.json().providerActionAttempted, false);
  assert.equal(paymentStatus.json().reconciliationRequired, false);
  assert.equal(paymentStatus.json().productionChargingEnabled, false);
  expectCode(await get(`/v1/payments/${preparedPayment.json().paymentIntentId}/status`, tokens.outsider), 403, 'FINANCE_FORBIDDEN');
  expectCode(await get(`/v1/receipts/${successfulCreated.json().bookingId}`, registeredToken), 409, 'RECEIPT_NOT_READY');
  const financeProgress = await get(`/v1/bookings/${successfulCreated.json().bookingId}/core-journey-progress`, registeredToken);
  expectCode(financeProgress, 200);
  assert.equal(financeProgress.json().paymentIntentStatus, 'CREATED');
  assert.equal(financeProgress.json().productionChargingEnabled, false);
  assert.equal(financeProgress.json().nextAction, 'PAYMENT_PROVIDER_UNAVAILABLE');
  assert.equal(financeProgress.json().milestones.find((milestone) => milestone.name === 'FINANCE').status, 'BLOCKED');
  expectCode(await del('/v1/identity/session', driverToken), 204);

  const riderIncident = await get(`/v1/bookings/${ids.incidentBooking}/core-journey-progress`, tokens.actor);
  expectCode(riderIncident, 200);
  assert.equal(riderIncident.json().disposition, 'SUPPORT_REQUIRED');
  assert.equal(riderIncident.json().interruptionReason, 'ACTIVE_INCIDENT');
  assert.equal(riderIncident.json().nextAction, 'SUPPORT_REQUIRED');

  const driverIncident = await get(`/v1/driver/bookings/${ids.incidentBooking}/core-journey-progress`, tokens.actor);
  expectCode(driverIncident, 200);
  assert.deepEqual(driverIncident.json(), riderIncident.json());

  const controlIncident = await get(`/v1/control-room/fatigue-handovers/${ids.handover}/bookings/${ids.incidentBooking}/core-journey-progress`, tokens.operator);
  expectCode(controlIncident, 200);
  assert.deepEqual(controlIncident.json(), riderIncident.json());

  const completed = await get(`/v1/bookings/${ids.completedBooking}/core-journey-progress`, tokens.actor);
  expectCode(completed, 200);
  assert.equal(completed.json().disposition, 'CLOSED');
  assert.equal(completed.json().paymentIntentStatus, 'CAPTURED');
  assert.ok(completed.json().milestones.every((milestone) => milestone.status === 'COMPLETED'));

  const cancelled = await get(`/v1/bookings/${ids.cancelledBooking}/core-journey-progress`, tokens.actor);
  expectCode(cancelled, 200);
  assert.equal(cancelled.json().disposition, 'CLOSED');
  assert.equal(cancelled.json().interruptionReason, 'RIDER_CANCELLED');
  assert.equal(cancelled.json().nextAction, 'JOURNEY_CLOSED');

  expectCode(await get(`/v1/bookings/${ids.privateBooking}/core-journey-progress`, tokens.actor), 404, 'CORE_JOURNEY_NOT_FOUND');
  expectCode(await get(`/v1/driver/bookings/${ids.privateBooking}/core-journey-progress`, tokens.actor), 404, 'CORE_JOURNEY_NOT_FOUND');
  expectCode(await get(`/v1/control-room/fatigue-handovers/${ids.handover}/bookings/${ids.incidentBooking}/core-journey-progress`, tokens.outsider), 404, 'CORE_JOURNEY_NOT_FOUND');
  expectCode(await get(`/v1/bookings/${ids.incidentBooking}/core-journey-progress`, tokens.expired), 403, 'RIDER_SESSION_REQUIRED');
  expectCode(await get(`/v1/bookings/${ids.incidentBooking}/core-journey-progress`), 401, 'AUTHENTICATION_REQUIRED');
  expectCode(await del('/v1/identity/session', registeredToken), 204);
  expectCode(await get('/v1/identity/session', registeredToken), 401, 'SESSION_INVALID');

  console.log('DAZAT core-journey database-backed HTTP verification PASSED');
} finally {
  if (app) await app.close();
  await client.query('ROLLBACK').catch(() => {});
  client.release();
  await pool.end();
}
