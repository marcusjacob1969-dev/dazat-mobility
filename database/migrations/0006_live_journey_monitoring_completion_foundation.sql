-- DAZAT Mobility — Engineering Phase 0.6
-- Live Journey telemetry, governed route changes, Safety signals, arrival-at-destination and completion.
-- Silence/disconnect is never completion; route concern is never an automatic misconduct finding.

ALTER TYPE journey.journey_status ADD VALUE IF NOT EXISTS 'ARRIVING';
ALTER TYPE journey.journey_status ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE journey.journey_leg_status ADD VALUE IF NOT EXISTS 'ARRIVING';
ALTER TYPE journey.journey_leg_status ADD VALUE IF NOT EXISTS 'COMPLETED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='journey_health_state') THEN
    CREATE TYPE journey.journey_health_state AS ENUM ('NORMAL','ATTENTION','AT_RISK','INCIDENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='journey' AND t.typname='route_deviation_severity') THEN
    CREATE TYPE journey.route_deviation_severity AS ENUM ('MINOR','MODERATE','SIGNIFICANT','CRITICAL');
  END IF;
END $$;

ALTER TABLE journey.driver_location_observation
  ADD COLUMN IF NOT EXISTS movement_plausible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS movement_blocker text,
  ADD COLUMN IF NOT EXISTS implied_speed_metres_per_second numeric(10,3);

ALTER TABLE journey.journey
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE journey.command_deduplication
  ADD COLUMN IF NOT EXISTS request_fingerprint text;

ALTER TABLE journey.driver_location_observation
  DROP CONSTRAINT IF EXISTS driver_location_observation_movement_blocker_check;
ALTER TABLE journey.driver_location_observation
  ADD CONSTRAINT driver_location_observation_movement_blocker_check
  CHECK (movement_blocker IS NULL OR movement_blocker IN ('OUT_OF_ORDER_LOCATION','IMPOSSIBLE_JUMP'));

CREATE TABLE IF NOT EXISTS journey.journey_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  sequence_number bigint NOT NULL CHECK (sequence_number > 0),
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  command_id uuid,
  correlation_id uuid,
  classification text NOT NULL DEFAULT 'CONFIDENTIAL' CHECK (classification IN ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','HIGHLY_RESTRICTED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, sequence_number),
  UNIQUE (command_id)
);

DROP TRIGGER IF EXISTS journey_event_immutable ON journey.journey_event;
CREATE TRIGGER journey_event_immutable
BEFORE UPDATE OR DELETE ON journey.journey_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.route_deviation_signal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('RIDER_REPORT','DRIVER_REPORT','ROUTING_CONTEXT','CONTROL_ROOM')),
  category text NOT NULL,
  severity journey.route_deviation_severity NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  location_observation_id uuid REFERENCES journey.driver_location_observation(id) ON DELETE RESTRICT,
  misconduct_finding boolean NOT NULL DEFAULT false CHECK (misconduct_finding = false),
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS route_deviation_signal_immutable ON journey.route_deviation_signal;
CREATE TRIGGER route_deviation_signal_immutable
BEFORE UPDATE OR DELETE ON journey.route_deviation_signal
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.route_change_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  request_type text NOT NULL CHECK (request_type IN ('ADD_STOP','CHANGE_DESTINATION')),
  requested_location_snapshot_id uuid NOT NULL REFERENCES booking.location_snapshot(id) ON DELETE RESTRICT,
  requested_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  expected_journey_version bigint NOT NULL CHECK (expected_journey_version > 0),
  status text NOT NULL DEFAULT 'PENDING_POLICY_REVIEW' CHECK (status IN ('PENDING_POLICY_REVIEW','APPROVED','REJECTED','APPLIED','EXPIRED')),
  reason_code text NOT NULL,
  pricing_status text NOT NULL DEFAULT 'NOT_EVALUATED' CHECK (pricing_status IN ('NOT_EVALUATED','UNCHANGED','REQUOTE_REQUIRED','UNAVAILABLE')),
  driver_acknowledgement_status text NOT NULL DEFAULT 'NOT_REQUESTED' CHECK (driver_acknowledgement_status IN ('NOT_REQUESTED','PENDING','ACKNOWLEDGED','DECLINED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journey.route_change_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_change_request_id uuid NOT NULL REFERENCES journey.route_change_request(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('PENDING_POLICY_REVIEW','APPROVED','REJECTED','APPLIED','EXPIRED')),
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS route_change_transition_immutable ON journey.route_change_transition;
CREATE TRIGGER route_change_transition_immutable
BEFORE UPDATE OR DELETE ON journey.route_change_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.destination_approach_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  location_observation_id uuid NOT NULL REFERENCES journey.driver_location_observation(id) ON DELETE RESTRICT,
  destination_snapshot_id uuid NOT NULL REFERENCES booking.location_snapshot(id) ON DELETE RESTRICT,
  distance_metres numeric(10,2) NOT NULL CHECK (distance_metres >= 0),
  permitted_radius_metres integer NOT NULL CHECK (permitted_radius_metres > 0),
  accepted boolean NOT NULL,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_leg_id)
);

DROP TRIGGER IF EXISTS destination_approach_evidence_immutable ON journey.destination_approach_evidence;
CREATE TRIGGER destination_approach_evidence_immutable
BEFORE UPDATE OR DELETE ON journey.destination_approach_evidence
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.completion_requirement_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  service_context text NOT NULL CHECK (service_context IN ('STANDARD','SCHOOL','HOSPITAL','SPECIALIST')),
  handover_required boolean NOT NULL,
  source_booking_requirement_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  policy_version text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_leg_id)
);

DROP TRIGGER IF EXISTS completion_requirement_snapshot_immutable ON journey.completion_requirement_snapshot;
CREATE TRIGGER completion_requirement_snapshot_immutable
BEFORE UPDATE OR DELETE ON journey.completion_requirement_snapshot
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.handover_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('AUTHORISED_HANDOVER','HANDOVER_FAILED')),
  authorised_recipient_reference uuid,
  recorded_by uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  verification_method text,
  failure_reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (outcome = 'AUTHORISED_HANDOVER' AND authorised_recipient_reference IS NOT NULL AND failure_reason_code IS NULL)
    OR (outcome = 'HANDOVER_FAILED' AND failure_reason_code IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS handover_record_immutable ON journey.handover_record;
CREATE TRIGGER handover_record_immutable
BEFORE UPDATE OR DELETE ON journey.handover_record
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.continuity_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','RESOLVED')),
  reason_code text NOT NULL,
  opened_by uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((status = 'OPEN' AND resolved_at IS NULL) OR (status = 'RESOLVED' AND resolved_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_one_open_continuity_case
  ON journey.continuity_case (journey_id) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS journey.continuity_case_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  continuity_case_id uuid NOT NULL REFERENCES journey.continuity_case(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('OPEN','RESOLVED')),
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS continuity_case_transition_immutable ON journey.continuity_case_transition;
CREATE TRIGGER continuity_case_transition_immutable
BEFORE UPDATE OR DELETE ON journey.continuity_case_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS journey.completion_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  journey_leg_id uuid NOT NULL REFERENCES journey.journey_leg(id) ON DELETE RESTRICT,
  destination_approach_evidence_id uuid NOT NULL REFERENCES journey.destination_approach_evidence(id) ON DELETE RESTRICT,
  final_location_observation_id uuid NOT NULL REFERENCES journey.driver_location_observation(id) ON DELETE RESTRICT,
  final_distance_metres numeric(10,2) NOT NULL CHECK (final_distance_metres >= 0),
  completion_requirement_snapshot_id uuid NOT NULL REFERENCES journey.completion_requirement_snapshot(id) ON DELETE RESTRICT,
  handover_record_id uuid REFERENCES journey.handover_record(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  active_hold_checked boolean NOT NULL,
  continuity_checked boolean NOT NULL,
  accepted boolean NOT NULL,
  policy_version text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_leg_id)
);

DROP TRIGGER IF EXISTS completion_evidence_immutable ON journey.completion_evidence;
CREATE TRIGGER completion_evidence_immutable
BEFORE UPDATE OR DELETE ON journey.completion_evidence
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

ALTER TABLE safety.safety_event
  ADD COLUMN IF NOT EXISTS actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS signal_source text,
  ADD COLUMN IF NOT EXISTS do_not_auto_call_reporter boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_confidence journey.telemetry_confidence_state NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS security_classification text NOT NULL DEFAULT 'HIGHLY_RESTRICTED',
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

ALTER TABLE safety.safety_event
  DROP CONSTRAINT IF EXISTS safety_event_security_classification_check;
ALTER TABLE safety.safety_event
  ADD CONSTRAINT safety_event_security_classification_check
  CHECK (security_classification IN ('RESTRICTED','HIGHLY_RESTRICTED'));

CREATE TABLE IF NOT EXISTS safety.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  actor_id uuid NOT NULL,
  journey_id uuid NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, actor_id, journey_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS safety.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_event_id uuid NOT NULL REFERENCES safety.safety_event(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  security_classification text NOT NULL CHECK (security_classification IN ('RESTRICTED','HIGHLY_RESTRICTED')),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text,
  UNIQUE (safety_event_id, event_type)
);

CREATE INDEX IF NOT EXISTS safety_outbox_unpublished_idx
  ON safety.outbox_message (occurred_at) WHERE published_at IS NULL;

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
       j.updated_at,
       CASE
         WHEN EXISTS (SELECT 1 FROM safety.safety_event se WHERE se.journey_id = j.id AND se.status <> 'RESOLVED' AND se.severity = 'CRITICAL') THEN 'INCIDENT'::journey.journey_health_state
         WHEN EXISTS (SELECT 1 FROM safety.safety_event se WHERE se.journey_id = j.id AND se.status <> 'RESOLVED' AND se.severity = 'AT_RISK') THEN 'AT_RISK'::journey.journey_health_state
         WHEN EXISTS (SELECT 1 FROM safety.safety_event se WHERE se.journey_id = j.id AND se.status <> 'RESOLVED') THEN 'ATTENTION'::journey.journey_health_state
         ELSE 'NORMAL'::journey.journey_health_state
       END AS journey_health,
       latest.movement_plausible,
       EXISTS (SELECT 1 FROM journey.continuity_case c WHERE c.journey_id = j.id AND c.status = 'OPEN') AS active_continuity_case
  FROM journey.journey j
  JOIN booking.booking b ON b.id = j.booking_id
  JOIN dispatch.driver_assignment da ON da.id = j.active_assignment_id
  LEFT JOIN LATERAL (
    SELECT observation.observed_at, observation.telemetry_state, observation.movement_plausible
      FROM journey.driver_location_observation observation
     WHERE observation.journey_id = j.id
     ORDER BY observation.observed_at DESC, observation.received_at DESC
     LIMIT 1
  ) latest ON true;

COMMENT ON TABLE journey.journey_event IS 'Append-only authoritative Journey timeline with aggregate-scoped ordering and classification.';
COMMENT ON TABLE journey.route_deviation_signal IS 'Contextual signal only. Severity/confidence do not create an automatic misconduct finding.';
COMMENT ON TABLE journey.route_change_request IS 'Governed request. Route is not changed until pricing, authority and Driver acknowledgement rules succeed.';
COMMENT ON TABLE journey.handover_record IS 'Restricted completion evidence; knowing passenger details does not create handover authority.';
COMMENT ON TABLE journey.continuity_case IS 'An open continuity case is an explicit completion blocker; disconnect or silence cannot resolve it.';
COMMENT ON TABLE safety.outbox_message IS 'Restricted Safety event channel. External delivery failure never rolls back or erases the canonical Safety signal.';
COMMENT ON VIEW journey.control_room_projection IS 'Read-only active Journey projection. Restricted Safety facts stay in the Safety owner and all mutations revalidate owner state.';
