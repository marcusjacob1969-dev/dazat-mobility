-- DAZAT Mobility — Engineering Phase 0.40
-- Task-scoped Control Room ownership for active-Journey fatigue handovers.

CREATE TABLE IF NOT EXISTS operations.control_room_role_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  role_code text NOT NULL CHECK (role_code IN ('FATIGUE_HANDOVER_OPERATOR','SAFETY_SUPERVISOR')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  assigned_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL CHECK (btrim(evidence_reference) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS control_room_current_role_idx
  ON operations.control_room_role_assignment (operator_person_id, role_code, valid_until);

DROP TRIGGER IF EXISTS control_room_role_assignment_immutable ON operations.control_room_role_assignment;
CREATE TRIGGER control_room_role_assignment_immutable BEFORE UPDATE OR DELETE ON operations.control_room_role_assignment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS operations.control_room_task_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  role_assignment_id uuid NOT NULL REFERENCES operations.control_room_role_assignment(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose = 'DRIVER_FATIGUE_HANDOVER'),
  subject_type text NOT NULL CHECK (subject_type = 'DRIVER_FATIGUE_HANDOVER'),
  subject_id uuid NOT NULL REFERENCES operations.driver_fatigue_handover(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from),
  UNIQUE (purpose, subject_id)
);

DROP TRIGGER IF EXISTS control_room_task_scope_immutable ON operations.control_room_task_scope;
CREATE TRIGGER control_room_task_scope_immutable BEFORE UPDATE OR DELETE ON operations.control_room_task_scope
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS operations.control_room_command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  operator_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, operator_person_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS operations.control_room_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('control-room.fatigue-handover-owned')),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS control_room_outbox_unpublished_idx
  ON operations.control_room_outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE operations.control_room_task_scope IS 'Purpose-bound operator access to one fatigue handover. It grants no general Driver, Journey, Safety, Finance or database-edit authority.';
