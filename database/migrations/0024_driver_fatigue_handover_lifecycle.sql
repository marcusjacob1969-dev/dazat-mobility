-- DAZAT Mobility — Engineering Phase 0.39
-- Durable controlled-handover lifecycle for fatigue reported during an active Journey.

CREATE TABLE IF NOT EXISTS operations.driver_fatigue_handover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatigue_observation_id uuid NOT NULL UNIQUE REFERENCES driver.driver_fatigue_observation(id) ON DELETE RESTRICT,
  operational_hold_id uuid NOT NULL UNIQUE REFERENCES journey.operational_hold(id) ON DELETE RESTRICT,
  support_case_id uuid NOT NULL UNIQUE REFERENCES operations.driver_support_case(id) ON DELETE RESTRICT,
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
    'REQUESTED','OWNED','REPLACEMENT_ASSIGNED','PASSENGER_TRANSFERRED','SAFE_STOP_CONFIRMED','COMPLETED'
  )),
  passenger_continuity_required boolean NOT NULL DEFAULT true CHECK (passenger_continuity_required),
  owned_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  replacement_assignment_id uuid REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  passenger_transfer_evidence_reference text,
  safe_stop_evidence_reference text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (status = 'REQUESTED' OR owned_by_person_id IS NOT NULL),
  CHECK (status <> 'REPLACEMENT_ASSIGNED' OR replacement_assignment_id IS NOT NULL),
  CHECK (status <> 'PASSENGER_TRANSFERRED' OR (passenger_transfer_evidence_reference IS NOT NULL AND btrim(passenger_transfer_evidence_reference) <> '')),
  CHECK (status <> 'SAFE_STOP_CONFIRMED' OR (safe_stop_evidence_reference IS NOT NULL AND btrim(safe_stop_evidence_reference) <> '')),
  CHECK (status <> 'COMPLETED' OR passenger_transfer_evidence_reference IS NOT NULL OR safe_stop_evidence_reference IS NOT NULL),
  CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS driver_fatigue_handover_active_idx
  ON operations.driver_fatigue_handover (status, created_at)
  WHERE status <> 'COMPLETED';

CREATE TABLE IF NOT EXISTS operations.driver_fatigue_handover_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES operations.driver_fatigue_handover(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN (
    'REQUESTED','OWNED','REPLACEMENT_ASSIGNED','PASSENGER_TRANSFERRED','SAFE_STOP_CONFIRMED','COMPLETED'
  )),
  actor_type text NOT NULL CHECK (actor_type IN ('DRIVER','CONTROL_ROOM','SAFETY','SYSTEM')),
  actor_id uuid,
  reason_code text NOT NULL CHECK (btrim(reason_code) <> ''),
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_references) = 'array'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION operations.guard_driver_fatigue_handover_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.fatigue_observation_id IS DISTINCT FROM NEW.fatigue_observation_id
     OR OLD.operational_hold_id IS DISTINCT FROM NEW.operational_hold_id
     OR OLD.support_case_id IS DISTINCT FROM NEW.support_case_id
     OR OLD.journey_id IS DISTINCT FROM NEW.journey_id
     OR OLD.assignment_id IS DISTINCT FROM NEW.assignment_id
     OR OLD.driver_profile_id IS DISTINCT FROM NEW.driver_profile_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
     OR OLD.passenger_continuity_required IS DISTINCT FROM NEW.passenger_continuity_required THEN
    RAISE EXCEPTION 'Fatigue handover identity and continuity envelope are immutable';
  END IF;
  IF NEW.version <> OLD.version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Fatigue handover update requires next version and later time';
  END IF;
  IF OLD.passenger_transfer_evidence_reference IS NOT NULL
     AND OLD.passenger_transfer_evidence_reference IS DISTINCT FROM NEW.passenger_transfer_evidence_reference THEN
    RAISE EXCEPTION 'Passenger transfer evidence is immutable once recorded';
  END IF;
  IF OLD.safe_stop_evidence_reference IS NOT NULL
     AND OLD.safe_stop_evidence_reference IS DISTINCT FROM NEW.safe_stop_evidence_reference THEN
    RAISE EXCEPTION 'Safe-stop evidence is immutable once recorded';
  END IF;
  IF OLD.status = 'COMPLETED' THEN RAISE EXCEPTION 'Completed fatigue handover is terminal'; END IF;
  IF NOT (
    (OLD.status = 'REQUESTED' AND NEW.status = 'OWNED') OR
    (OLD.status = 'OWNED' AND NEW.status IN ('REPLACEMENT_ASSIGNED','SAFE_STOP_CONFIRMED')) OR
    (OLD.status = 'REPLACEMENT_ASSIGNED' AND NEW.status IN ('PASSENGER_TRANSFERRED','SAFE_STOP_CONFIRMED')) OR
    (OLD.status IN ('PASSENGER_TRANSFERRED','SAFE_STOP_CONFIRMED') AND NEW.status = 'COMPLETED')
  ) THEN RAISE EXCEPTION 'Invalid fatigue handover transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_fatigue_handover_update_guard ON operations.driver_fatigue_handover;
CREATE TRIGGER driver_fatigue_handover_update_guard
BEFORE UPDATE ON operations.driver_fatigue_handover
FOR EACH ROW EXECUTE FUNCTION operations.guard_driver_fatigue_handover_update();

DROP TRIGGER IF EXISTS driver_fatigue_handover_no_delete ON operations.driver_fatigue_handover;
CREATE TRIGGER driver_fatigue_handover_no_delete
BEFORE DELETE ON operations.driver_fatigue_handover
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS driver_fatigue_handover_transition_immutable ON operations.driver_fatigue_handover_transition;
CREATE TRIGGER driver_fatigue_handover_transition_immutable
BEFORE UPDATE OR DELETE ON operations.driver_fatigue_handover_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

COMMENT ON TABLE operations.driver_fatigue_handover IS 'Controlled active-Journey fatigue continuity; creation is not evidence that Control Room ownership, replacement, transfer or safe stop occurred.';
