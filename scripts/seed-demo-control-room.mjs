// Test-environment seeding only. Creates ONE synthetic in-progress journey with an active Safety hold
// (driver fatigue) and a fatigue-handover task scoped to a registered demo operator, so the Control Room
// can show a canonical SUPPORT_REQUIRED journey. Mirrors the rows used by the Core Journey HTTP verifier.
// Everything runs in one transaction. No payment, communication or provider behaviour is enabled.
//
// Usage (DATABASE_URL = the Render *External* database URL, set in your own shell):
//   node scripts/seed-demo-control-room.mjs <operatorAccountId>
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const operatorAccountId = process.argv[2];
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!operatorAccountId || !/^[0-9a-f-]{36}$/i.test(operatorAccountId)) {
  throw new Error('Usage: node scripts/seed-demo-control-room.mjs <operatorAccountId>');
}

const ids = Object.fromEntries([
  'actorPerson', 'riderProfile', 'driverProfile', 'pickup', 'dropoff', 'booking', 'quote', 'fare', 'vehicle',
  'attempt', 'candidate', 'offer', 'assignment', 'journey', 'leg', 'location', 'arrival', 'ridecheck', 'payment',
  'shift', 'fatigue', 'hold', 'support', 'handover', 'role', 'task'
].map((name) => [name, randomUUID()]));

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('BEGIN');
  const operator = await client.query('SELECT person_id FROM identity.user_account WHERE id = $1', [operatorAccountId]);
  if (!operator.rowCount) throw new Error('No such operator account. Register it through the API first.');
  const operatorPerson = operator.rows[0].person_id;

  await client.query(`
    INSERT INTO identity.person (id) VALUES ('${ids.actorPerson}');
    INSERT INTO rider.rider_profile (id, person_id) VALUES ('${ids.riderProfile}', '${ids.actorPerson}');
    INSERT INTO driver.driver_profile (id, person_id, onboarding_status, operating_status)
      VALUES ('${ids.driverProfile}', '${ids.actorPerson}', 'NOT_STARTED', 'ONLINE');
    INSERT INTO booking.location_snapshot (id, point, display_label) VALUES
      ('${ids.pickup}', ST_SetSRID(ST_MakePoint(-0.1276, 51.5072), 4326)::geography, 'Demo safety-hold pickup'),
      ('${ids.dropoff}', ST_SetSRID(ST_MakePoint(-0.0877, 51.5074), 4326)::geography, 'Demo safety-hold destination');
    INSERT INTO booking.booking (id, status, pickup_snapshot_id, dropoff_snapshot_id, region_code) VALUES
      ('${ids.booking}', 'ACTIVE_INCIDENT', '${ids.pickup}', '${ids.dropoff}', 'GB-LON');
    INSERT INTO booking.booking_party (booking_id, role, person_id) VALUES ('${ids.booking}', 'BOOKER', '${ids.actorPerson}');
    INSERT INTO pricing.quote (id, booking_id, status, amount_minor, currency, policy_version, source_mode, expires_at, accepted_at) VALUES
      ('${ids.quote}', '${ids.booking}', 'ACCEPTED', 2500, 'GBP', 'demo-seed', 'CI_FIXTURE', now() + interval '1 hour', now());
    INSERT INTO pricing.fare_agreement (id, booking_id, quote_id, amount_minor, currency, policy_version) VALUES
      ('${ids.fare}', '${ids.booking}', '${ids.quote}', 2500, 'GBP', 'demo-seed');
    INSERT INTO vehicle_fleet.vehicle (id, registration_mark, lifecycle_status) VALUES ('${ids.vehicle}', 'DM00 HOLD', 'ACTIVE');
    INSERT INTO dispatch.dispatch_attempt (id, booking_id, booking_aggregate_version, status, region_code, policy_version, attempt_number, completed_at) VALUES
      ('${ids.attempt}', '${ids.booking}', 1, 'ASSIGNED', 'GB-LON', 'demo-seed', 1, now());
    INSERT INTO dispatch.candidate_snapshot (id, dispatch_attempt_id, driver_profile_id, vehicle_id, driver_eligibility_snapshot_id, vehicle_eligibility_snapshot_id, availability_version, rank_position) VALUES
      ('${ids.candidate}', '${ids.attempt}', '${ids.driverProfile}', '${ids.vehicle}', gen_random_uuid(), gen_random_uuid(), 1, 1);
    INSERT INTO dispatch.driver_offer (id, dispatch_attempt_id, candidate_snapshot_id, booking_id, driver_profile_id, vehicle_id, status, meaningful_offer_payload, expires_at, responded_at) VALUES
      ('${ids.offer}', '${ids.attempt}', '${ids.candidate}', '${ids.booking}', '${ids.driverProfile}', '${ids.vehicle}', 'ACCEPTED', '{}', now() + interval '1 hour', now());
    INSERT INTO dispatch.driver_assignment (id, dispatch_attempt_id, accepted_offer_id, booking_id, driver_profile_id, vehicle_id, status, ended_at, end_reason) VALUES
      ('${ids.assignment}', '${ids.attempt}', '${ids.offer}', '${ids.booking}', '${ids.driverProfile}', '${ids.vehicle}', 'ACTIVE', null, null);
    INSERT INTO journey.journey (id, booking_id, active_assignment_id, status, started_at) VALUES
      ('${ids.journey}', '${ids.booking}', '${ids.assignment}', 'IN_PROGRESS', now());
    INSERT INTO journey.journey_leg (id, journey_id, sequence_number, driver_assignment_id, status, started_at, ended_at) VALUES
      ('${ids.leg}', '${ids.journey}', 1, '${ids.assignment}', 'IN_PROGRESS', now(), null);
    INSERT INTO journey.driver_location_observation (id, journey_id, journey_leg_id, driver_profile_id, client_observation_id, point, observed_at, source, accuracy_metres, confidence, telemetry_state, usable_for_critical_decision) VALUES
      ('${ids.location}', '${ids.journey}', '${ids.leg}', '${ids.driverProfile}', gen_random_uuid(), ST_SetSRID(ST_MakePoint(-0.1276, 51.5072),4326)::geography, now(), 'DEVICE_GPS', 5, 0.99, 'LIVE', true);
    INSERT INTO journey.arrival_evidence (id, journey_id, journey_leg_id, driver_location_observation_id, pickup_snapshot_id, distance_metres, permitted_radius_metres, accepted, policy_version) VALUES
      ('${ids.arrival}', '${ids.journey}', '${ids.leg}', '${ids.location}', '${ids.pickup}', 0, 200, true, 'demo-seed');
    INSERT INTO journey.ridecheck_session (id, journey_id, journey_leg_id, driver_assignment_id, passenger_person_id, driver_profile_id, vehicle_id, method, status, challenge_salt, challenge_verifier, maximum_attempts, expires_at, verified_at) VALUES
      ('${ids.ridecheck}', '${ids.journey}', '${ids.leg}', '${ids.assignment}', '${ids.actorPerson}', '${ids.driverProfile}', '${ids.vehicle}', 'PIN', 'VERIFIED', 'demo-salt', 'demo-verifier', 5, now() + interval '1 hour', now());
    INSERT INTO finance.payment_intent (id, booking_id, fare_agreement_id, payer_person_id, amount_minor, currency, status, charging_eligibility) VALUES
      ('${ids.payment}', '${ids.booking}', '${ids.fare}', '${ids.actorPerson}', 2500, 'GBP', 'CREATED', 'NOT_ELIGIBLE');
    INSERT INTO driver.driver_shift_session (id, driver_profile_id, status, region_code, selected_vehicle_id, start_availability_version) VALUES
      ('${ids.shift}', '${ids.driverProfile}', 'ACTIVE', 'GB-LON', '${ids.vehicle}', 1);
    INSERT INTO driver.driver_fatigue_observation (id, driver_profile_id, driver_shift_session_id, observation_type, status, source_type, evidence_reference, observed_at) VALUES
      ('${ids.fatigue}', '${ids.driverProfile}', '${ids.shift}', 'DRIVER_REPORTED_FATIGUE', 'ACTIVE', 'DRIVER_SELF_REPORT', 'demo-seed-fixture', now());
    INSERT INTO journey.operational_hold (id, journey_id, status, reason_code, source_type, source_id) VALUES
      ('${ids.hold}', '${ids.journey}', 'ACTIVE', 'DRIVER_FATIGUE', 'SAFETY', '${ids.fatigue}');
    INSERT INTO operations.driver_support_case (id, driver_profile_id, category, risk, status, journey_id, booking_id, vehicle_id, summary_reference, human_escalation_required, created_by_person_id) VALUES
      ('${ids.support}', '${ids.driverProfile}', 'SAFETY', 'HIGH_RISK_ACTIVE', 'HUMAN_ESCALATION_REQUIRED', '${ids.journey}', '${ids.booking}', '${ids.vehicle}', 'demo-seed-fatigue', true, '${ids.actorPerson}');
    INSERT INTO operations.driver_fatigue_handover (id, fatigue_observation_id, operational_hold_id, support_case_id, journey_id, assignment_id, driver_profile_id, status) VALUES
      ('${ids.handover}', '${ids.fatigue}', '${ids.hold}', '${ids.support}', '${ids.journey}', '${ids.assignment}', '${ids.driverProfile}', 'REQUESTED');
    INSERT INTO operations.control_room_role_assignment (id, operator_person_id, role_code, valid_from, valid_until, assigned_by_person_id, evidence_reference) VALUES
      ('${ids.role}', '${operatorPerson}', 'FATIGUE_HANDOVER_OPERATOR', now() - interval '1 minute', now() + interval '7 days', '${operatorPerson}', 'demo-seed-role');
    INSERT INTO operations.control_room_task_scope (id, operator_person_id, role_assignment_id, purpose, subject_type, subject_id, valid_from, valid_until) VALUES
      ('${ids.task}', '${operatorPerson}', '${ids.role}', 'DRIVER_FATIGUE_HANDOVER', 'DRIVER_FATIGUE_HANDOVER', '${ids.handover}', now() - interval '1 minute', now() + interval '7 days');
  `);

  await client.query('COMMIT');
  console.log(JSON.stringify({ seeded: true, controlledHandoverId: ids.handover, bookingId: ids.booking, validDays: 7 }));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
