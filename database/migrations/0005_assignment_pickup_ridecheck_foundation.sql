-- DAZAT Mobility — Engineering Phase 0.5
-- Active assignment -> acknowledged Journey -> evidence-backed arrival -> RideCheck -> protected start.
-- Raw RideCheck challenges are never persisted and normal operations have no start bypass.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='journey_status') THEN
    CREATE TYPE journey.journey_status AS ENUM ('ASSIGNED','EN_ROUTE','ARRIVED','AWAITING_RIDECHECK','PASSENGER_VERIFIED','IN_PROGRESS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='journey_leg_status') THEN
    CREATE TYPE journey.journey_leg_status AS ENUM ('ASSIGNED','EN_ROUTE','ARRIVED','READY_TO_START','IN_PROGRESS','INTERRUPTED','COMPLETED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='telemetry_confidence_state') THEN
    CREATE TYPE journey.telemetry_confidence_state AS ENUM ('LIVE','DELAYED','DEGRADED','STALE','UNKNOWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='ridecheck_status') THEN
    CREATE TYPE journey.ridecheck_status AS ENUM ('PENDING','VERIFIED','LOCKED','EXPIRED','SUPERSEDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='ridecheck_method') THEN
    CREATE TYPE journey.ridecheck_method AS ENUM ('PIN','QR','APP_CONFIRMATION','ASSISTED','GUARDIAN','SCHOOL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS journey.journey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  active_assignment_id uuid NOT NULL REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  status journey.journey_status NOT NULL DEFAULT 'ASSIGNED',
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE TABLE IF NOT EXISTS journey.journey_leg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  driver_assignment_id uuid NOT NULL REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  status journey.journey_leg_status NOT NULL DEFAULT 'ASSIGNED',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, sequence_number),
  UNIQUE (driver_assignment_id)
);

CREATE TABLE IF NOT EXISTS journey.state_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  from_status journey.journey_status,
  to_status journey.journey_status NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, aggregate_version),
  UNIQUE (command_id)
);

DROP TRIGGER IF EXISTS journey_state_transition_immutable ON journey.state_transition;
CREATE TRIGGER journey_state_transition_immutable
BEFORE UPDATE OR DELETE ON journey.state_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.driver_location_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL,
  client_observation_id uuid NOT NULL,
  point geography(Point,4326) NOT NULL,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('DEVICE_GPS','FLEET_TELEMATICS')),
  purpose text NOT NULL DEFAULT 'ACTIVE_ASSIGNMENT_PICKUP' CHECK (purpose IN ('ACTIVE_ASSIGNMENT_PICKUP','ACTIVE_JOURNEY','SAFETY_EVIDENCE')),
  accuracy_metres numeric(8,2) NOT NULL CHECK (accuracy_metres >= 0),
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  telemetry_state journey.telemetry_confidence_state NOT NULL,
  usable_for_critical_decision boolean NOT NULL,
  retention_class text NOT NULL DEFAULT 'MATERIAL_JOURNEY_EVIDENCE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, client_observation_id)
);

CREATE INDEX IF NOT EXISTS journey_location_latest_idx
  ON journey.driver_location_observation (journey_id, observed_at DESC, received_at DESC);

DROP TRIGGER IF EXISTS journey_driver_location_immutable ON journey.driver_location_observation;
CREATE TRIGGER journey_driver_location_immutable
BEFORE UPDATE OR DELETE ON journey.driver_location_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.arrival_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  driver_location_observation_id uuid NOT NULL REFERENCES journey.driver_location_observation(id) ON DELETE RESTRICT,
  pickup_snapshot_id uuid NOT NULL REFERENCES booking.location_snapshot(id) ON DELETE RESTRICT,
  distance_metres numeric(10,2) NOT NULL CHECK (distance_metres >= 0),
  permitted_radius_metres integer NOT NULL CHECK (permitted_radius_metres > 0),
  accepted boolean NOT NULL,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_leg_id)
);

DROP TRIGGER IF EXISTS journey_arrival_evidence_immutable ON journey.arrival_evidence;
CREATE TRIGGER journey_arrival_evidence_immutable
BEFORE UPDATE OR DELETE ON journey.arrival_evidence
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.ridecheck_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  driver_assignment_id uuid NOT NULL REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  passenger_person_id uuid NOT NULL,
  driver_profile_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  method journey.ridecheck_method NOT NULL,
  status journey.ridecheck_status NOT NULL DEFAULT 'PENDING',
  challenge_salt text NOT NULL,
  challenge_verifier text NOT NULL,
  attempts_used integer NOT NULL DEFAULT 0 CHECK (attempts_used >= 0),
  maximum_attempts integer NOT NULL CHECK (maximum_attempts > 0),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_one_pending_ridecheck_per_leg
  ON journey.ridecheck_session (journey_leg_id) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS journey.ridecheck_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ridecheck_session_id uuid NOT NULL REFERENCES journey.ridecheck_session(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  submitted_by_driver_profile_id uuid NOT NULL,
  verifier_matched boolean NOT NULL,
  result_status journey.ridecheck_status NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ridecheck_session_id, attempt_number)
);

DROP TRIGGER IF EXISTS journey_ridecheck_attempt_immutable ON journey.ridecheck_attempt;
CREATE TRIGGER journey_ridecheck_attempt_immutable
BEFORE UPDATE OR DELETE ON journey.ridecheck_attempt
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.operational_hold (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE','RELEASED')),
  reason_code text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('RIDECHECK','SAFETY','SAFEGUARDING','OPERATIONS')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  released_by uuid,
  release_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_one_active_hold_per_reason
  ON journey.operational_hold (journey_id, reason_code) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS journey.operational_hold_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_hold_id uuid NOT NULL REFERENCES journey.operational_hold(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('ACTIVE','RELEASED')),
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS journey_operational_hold_transition_immutable ON journey.operational_hold_transition;
CREATE TRIGGER journey_operational_hold_transition_immutable
BEFORE UPDATE OR DELETE ON journey.operational_hold_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  actor_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, actor_id, subject_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS journey.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  correlation_id uuid,
  causation_id uuid,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
);

CREATE INDEX IF NOT EXISTS journey_outbox_unpublished_idx
  ON journey.outbox_message (occurred_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS safety.safety_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  trigger_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('ATTENTION','AT_RISK','CRITICAL')),
  status text NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  finding_status text NOT NULL DEFAULT 'NOT_ASSESSED' CHECK (finding_status IN ('NOT_ASSESSED','SUBSTANTIATED','NOT_SUBSTANTIATED','INCONCLUSIVE')),
  source_reference uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety.safety_event_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_event_id uuid NOT NULL REFERENCES safety.safety_event(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS safety_event_transition_immutable ON safety.safety_event_transition;
CREATE TRIGGER safety_event_transition_immutable
BEFORE UPDATE OR DELETE ON safety.safety_event_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE VIEW journey.control_room_projection AS
SELECT j.id AS journey_id,
       j.booking_id,
       j.status AS journey_status,
       b.status AS booking_status,
       j.active_assignment_id,
       da.driver_profile_id,
       da.vehicle_id,
       EXISTS (SELECT 1 FROM journey.operational_hold h WHERE h.journey_id = j.id AND h.status = 'ACTIVE') AS active_operational_hold,
       latest.observed_at AS latest_location_observed_at,
       COALESCE(latest.telemetry_state, 'UNKNOWN'::journey.telemetry_confidence_state) AS telemetry_state,
       j.updated_at
  FROM journey.journey j
  JOIN booking.booking b ON b.id = j.booking_id
  JOIN dispatch.driver_assignment da ON da.id = j.active_assignment_id
  LEFT JOIN LATERAL (
    SELECT observation.observed_at, observation.telemetry_state
      FROM journey.driver_location_observation observation
     WHERE observation.journey_id = j.id
     ORDER BY observation.observed_at DESC, observation.received_at DESC
     LIMIT 1
  ) latest ON true;

COMMENT ON TABLE journey.driver_location_observation IS 'Append-only, purpose-labelled durable pickup/journey evidence. Age, source, accuracy and confidence remain explicit.';
COMMENT ON TABLE journey.ridecheck_session IS 'Stores only salted HMAC verifier material; the raw RideCheck challenge must never be persisted.';
COMMENT ON TABLE journey.ridecheck_attempt IS 'Append-only result evidence. Submitted raw PIN/QR material is never recorded.';
COMMENT ON TABLE journey.operational_hold IS 'Protected-start boundary. Normal support/Control Room paths cannot turn an ACTIVE hold into JourneyStarted.';
COMMENT ON TABLE safety.safety_event IS 'Canonical Safety intervention record. A RideCheck mismatch is a trigger for assessment, never an automatic misconduct finding.';
COMMENT ON VIEW journey.control_room_projection IS 'Read-only operational projection. All critical mutations must revalidate Journey owner state.';
