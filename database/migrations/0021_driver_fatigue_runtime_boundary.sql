-- DAZAT Mobility — Engineering Phase 0.35
-- Authoritative fatigue evidence and Dispatch-facing projection.

CREATE TABLE IF NOT EXISTS driver.driver_fatigue_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  driver_shift_session_id uuid NOT NULL REFERENCES driver.driver_shift_session(id) ON DELETE RESTRICT,
  observation_type text NOT NULL CHECK (observation_type IN ('DRIVER_REPORTED_FATIGUE','DROWSINESS_SIGNAL')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLEARED')),
  source_type text NOT NULL CHECK (source_type IN ('DRIVER_SELF_REPORT','APPROVED_DEVICE','CONTROL_ROOM')),
  evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
  observed_at timestamptz NOT NULL,
  cleared_at timestamptz,
  cleared_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  clear_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'ACTIVE' AND cleared_at IS NULL AND cleared_by_person_id IS NULL AND clear_reason IS NULL)
    OR (status = 'CLEARED' AND cleared_at IS NOT NULL AND cleared_by_person_id IS NOT NULL AND btrim(clear_reason) <> '')
  ),
  CHECK (cleared_at IS NULL OR cleared_at >= observed_at)
);

CREATE INDEX IF NOT EXISTS driver_active_fatigue_observation_idx
  ON driver.driver_fatigue_observation (driver_profile_id, observation_type, observed_at DESC)
  WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION driver.guard_fatigue_observation_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.driver_profile_id IS DISTINCT FROM NEW.driver_profile_id
     OR OLD.driver_shift_session_id IS DISTINCT FROM NEW.driver_shift_session_id
     OR OLD.observation_type IS DISTINCT FROM NEW.observation_type
     OR OLD.source_type IS DISTINCT FROM NEW.source_type
     OR OLD.evidence_reference IS DISTINCT FROM NEW.evidence_reference
     OR OLD.observed_at IS DISTINCT FROM NEW.observed_at
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Fatigue observation evidence is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status <> 'CLEARED' THEN
    RAISE EXCEPTION 'Fatigue observation only permits ACTIVE to CLEARED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_fatigue_observation_guard ON driver.driver_fatigue_observation;
CREATE TRIGGER driver_fatigue_observation_guard
BEFORE UPDATE ON driver.driver_fatigue_observation
FOR EACH ROW EXECUTE FUNCTION driver.guard_fatigue_observation_update();

DROP TRIGGER IF EXISTS driver_fatigue_observation_no_delete ON driver.driver_fatigue_observation;
CREATE TRIGGER driver_fatigue_observation_no_delete
BEFORE DELETE ON driver.driver_fatigue_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE VIEW driver.current_fatigue_safety_projection AS
SELECT profile.id AS driver_profile_id,
       shift.id AS driver_shift_session_id,
       shift.started_at AS shift_started_at,
       rest.rest_started_at AS last_qualifying_rest_started_at,
       rest.rest_ended_at AS last_qualifying_rest_ended_at,
       EXISTS (
         SELECT 1 FROM driver.driver_fatigue_observation observation
          WHERE observation.driver_profile_id = profile.id
            AND observation.driver_shift_session_id = shift.id
            AND observation.status = 'ACTIVE'
            AND observation.observation_type = 'DRIVER_REPORTED_FATIGUE'
       ) AS driver_reported_fatigue,
       EXISTS (
         SELECT 1 FROM driver.driver_fatigue_observation observation
          WHERE observation.driver_profile_id = profile.id
            AND observation.driver_shift_session_id = shift.id
            AND observation.status = 'ACTIVE'
            AND observation.observation_type = 'DROWSINESS_SIGNAL'
       ) AS drowsiness_signal_observed
  FROM driver.driver_profile profile
  LEFT JOIN driver.driver_shift_session shift
    ON shift.driver_profile_id = profile.id AND shift.status = 'ACTIVE'
  LEFT JOIN LATERAL (
    SELECT started.occurred_at AS rest_started_at, ended.occurred_at AS rest_ended_at
      FROM driver.driver_shift_event ended
      JOIN LATERAL (
        SELECT event.occurred_at
          FROM driver.driver_shift_event event
         WHERE event.driver_shift_session_id = ended.driver_shift_session_id
           AND event.to_availability = 'BREAK'
           AND event.occurred_at < ended.occurred_at
         ORDER BY event.occurred_at DESC LIMIT 1
      ) started ON true
     WHERE ended.driver_shift_session_id = shift.id
       AND ended.from_availability = 'BREAK'
       AND ended.to_availability IN ('AVAILABLE','FINISHING_SOON')
     ORDER BY ended.occurred_at DESC LIMIT 1
  ) rest ON true;

COMMENT ON TABLE driver.driver_fatigue_observation IS 'Append-preserved fatigue evidence. Evidence is not a Driver fault finding and only governed clearing is mutable.';
COMMENT ON VIEW driver.current_fatigue_safety_projection IS 'Authoritative active-shift, qualifying-rest and unresolved fatigue inputs for server-side Safety evaluation.';
