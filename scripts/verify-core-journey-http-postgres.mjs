import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  task: '70000000-0000-4000-8000-000000000047'
};

const tokens = {
  actor: 'dzs_phase070_actor_opaque_bearer_secret',
  operator: 'dzs_phase070_operator_opaque_bearer_secret',
  outsider: 'dzs_phase070_outsider_opaque_bearer_secret',
  expired: 'dzs_phase070_expired_opaque_bearer_secret'
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
    PRICING_MODE: 'development_fixture', DEVELOPMENT_QUOTE_AMOUNT_MINOR: '1800', DEVELOPMENT_QUOTE_CURRENCY: 'GBP'
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
