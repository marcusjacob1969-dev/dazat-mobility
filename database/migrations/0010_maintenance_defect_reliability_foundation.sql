-- DAZAT Mobility — Engineering Phase 0.10
-- Maintenance plans, Driver pre-shift concern reporting, defect/restriction truth,
-- warranty-first repair, reviewed return to service, verified perks and whole-life reliability evidence.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='vehicle_fleet' AND t.typname='maintenance_plan_source') THEN
    CREATE TYPE vehicle_fleet.maintenance_plan_source AS ENUM (
      'MANUFACTURER','LEGAL_LICENSING','DAZAT_POLICY','FLEET_AGREEMENT','DEFECT','RECALL','BREAKDOWN_FOLLOW_UP'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='vehicle_fleet' AND t.typname='maintenance_urgency') THEN
    CREATE TYPE vehicle_fleet.maintenance_urgency AS ENUM (
      'ROUTINE','DUE_SOON','OVERDUE','SAFETY_REVIEW','DO_NOT_USE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='vehicle_fleet' AND t.typname='defect_state') THEN
    CREATE TYPE vehicle_fleet.defect_state AS ENUM (
      'OPEN','UNDER_REVIEW','REPAIR_REQUIRED','MONITORING','RESOLVED','CLOSED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_maintenance_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL UNIQUE REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vehicle_maintenance_plan_immutable ON vehicle_fleet.vehicle_maintenance_plan;
CREATE TRIGGER vehicle_maintenance_plan_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_maintenance_plan
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_maintenance_plan_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_plan_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_maintenance_plan(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  supersedes_version_id uuid REFERENCES vehicle_fleet.vehicle_maintenance_plan_version(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','SUPERSEDED','ENDED')),
  source_types vehicle_fleet.maintenance_plan_source[] NOT NULL CHECK (cardinality(source_types) > 0),
  source_references jsonb NOT NULL CHECK (jsonb_typeof(source_references) = 'array' AND jsonb_array_length(source_references) > 0),
  policy_version text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maintenance_plan_id, version),
  CHECK ((version = 1 AND supersedes_version_id IS NULL) OR (version > 1 AND supersedes_version_id IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

DROP TRIGGER IF EXISTS vehicle_maintenance_plan_version_immutable ON vehicle_fleet.vehicle_maintenance_plan_version;
CREATE TRIGGER vehicle_maintenance_plan_version_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_maintenance_plan_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_plan_version_one_successor
  ON vehicle_fleet.vehicle_maintenance_plan_version (supersedes_version_id) WHERE supersedes_version_id IS NOT NULL;

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_maintenance_plan_version_chain()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_maintenance_plan_version prior
     WHERE prior.id = NEW.supersedes_version_id AND prior.maintenance_plan_id = NEW.maintenance_plan_id
       AND prior.version = NEW.version - 1
  ) THEN RAISE EXCEPTION 'Maintenance plan version must directly supersede its prior version'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS maintenance_plan_version_chain_guard ON vehicle_fleet.vehicle_maintenance_plan_version;
CREATE CONSTRAINT TRIGGER maintenance_plan_version_chain_guard
AFTER INSERT ON vehicle_fleet.vehicle_maintenance_plan_version
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_maintenance_plan_version_chain();

CREATE OR REPLACE VIEW vehicle_fleet.current_vehicle_maintenance_plan AS
SELECT plan.vehicle_id, plan.id AS maintenance_plan_id, version.id AS plan_version_id,
       version.version, version.source_types, version.source_references,
       version.policy_version, version.effective_from, version.effective_until
  FROM vehicle_fleet.vehicle_maintenance_plan plan
  JOIN vehicle_fleet.vehicle_maintenance_plan_version version ON version.maintenance_plan_id = plan.id
 WHERE version.version = (
   SELECT max(latest.version) FROM vehicle_fleet.vehicle_maintenance_plan_version latest
    WHERE latest.maintenance_plan_id = plan.id
 ) AND version.status = 'ACTIVE' AND version.effective_from <= now()
   AND (version.effective_until IS NULL OR version.effective_until > now());

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_requirement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_maintenance_plan_version(id) ON DELETE RESTRICT,
  requirement_code text NOT NULL,
  description text NOT NULL,
  source_type vehicle_fleet.maintenance_plan_source NOT NULL,
  source_reference text NOT NULL,
  due_at timestamptz,
  due_odometer integer CHECK (due_odometer IS NULL OR due_odometer >= 0),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, requirement_code),
  CHECK (due_at IS NOT NULL OR due_odometer IS NOT NULL)
);

DROP TRIGGER IF EXISTS maintenance_requirement_immutable ON vehicle_fleet.maintenance_requirement;
CREATE TRIGGER maintenance_requirement_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.maintenance_requirement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_requirement_evaluation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_requirement_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_requirement(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
  urgency vehicle_fleet.maintenance_urgency NOT NULL,
  odometer_observed integer CHECK (odometer_observed IS NULL OR odometer_observed >= 0),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  evaluated_by_authority text NOT NULL,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS maintenance_requirement_evaluation_immutable ON vehicle_fleet.maintenance_requirement_evaluation;
CREATE TRIGGER maintenance_requirement_evaluation_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.maintenance_requirement_evaluation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS maintenance_requirement_evaluation_latest_idx
  ON vehicle_fleet.maintenance_requirement_evaluation (maintenance_requirement_id, evaluated_at DESC, id DESC);

CREATE OR REPLACE VIEW vehicle_fleet.current_maintenance_requirement AS
SELECT requirement.id AS requirement_id, plan.vehicle_id, requirement.plan_version_id,
       requirement.requirement_code, requirement.description, requirement.source_type,
       requirement.source_reference, requirement.due_at, requirement.due_odometer,
       evaluation.id AS evaluation_id, evaluation.status, evaluation.urgency,
       evaluation.odometer_observed, evaluation.evaluated_at
  FROM vehicle_fleet.maintenance_requirement requirement
  JOIN vehicle_fleet.current_vehicle_maintenance_plan plan ON plan.plan_version_id = requirement.plan_version_id
  JOIN LATERAL (
    SELECT current_evaluation.* FROM vehicle_fleet.maintenance_requirement_evaluation current_evaluation
     WHERE current_evaluation.maintenance_requirement_id = requirement.id
     ORDER BY current_evaluation.evaluated_at DESC, current_evaluation.id DESC LIMIT 1
  ) evaluation ON true;

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_pre_shift_check (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL UNIQUE,
  idempotency_key text NOT NULL,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  odometer integer NOT NULL CHECK (odometer >= 0),
  check_items jsonb NOT NULL CHECK (jsonb_typeof(check_items) = 'object'),
  uncertain_concern_text text,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_references) = 'array'),
  outcome text NOT NULL CHECK (outcome IN ('PASS','CONCERN_REPORTED','FAIL')),
  maintenance_urgency vehicle_fleet.maintenance_urgency NOT NULL CHECK (maintenance_urgency IN ('ROUTINE','SAFETY_REVIEW','DO_NOT_USE')),
  vehicle_use_permitted boolean NOT NULL,
  driver_diagnosis_required boolean NOT NULL DEFAULT false CHECK (driver_diagnosis_required = false),
  creates_driver_fault_finding boolean NOT NULL DEFAULT false CHECK (creates_driver_fault_finding = false),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_profile_id, idempotency_key),
  CHECK (check_items ?& ARRAY['TYRES','LIGHTS','BRAKES','STEERING','MIRRORS','SEATBELTS','WARNING_INDICATORS','ACCESSIBILITY_EQUIPMENT']),
  CHECK ((check_items->>'TYRES') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'LIGHTS') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'BRAKES') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'STEERING') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'MIRRORS') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'SEATBELTS') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'WARNING_INDICATORS') IN ('PASS','FAIL','NOT_SURE')),
  CHECK ((check_items->>'ACCESSIBILITY_EQUIPMENT') IN ('PASS','FAIL','NOT_SURE','NOT_APPLICABLE')),
  CHECK (uncertain_concern_text IS NULL OR length(trim(uncertain_concern_text)) > 0),
  CHECK (
    (outcome = 'FAIL' AND jsonb_path_exists(check_items, '$.* ? (@ == "FAIL")'))
    OR (outcome = 'CONCERN_REPORTED' AND NOT jsonb_path_exists(check_items, '$.* ? (@ == "FAIL")')
      AND (jsonb_path_exists(check_items, '$.* ? (@ == "NOT_SURE")') OR uncertain_concern_text IS NOT NULL))
    OR (outcome = 'PASS' AND NOT jsonb_path_exists(check_items, '$.* ? (@ == "FAIL" || @ == "NOT_SURE")')
      AND uncertain_concern_text IS NULL)
  ),
  CHECK ((outcome = 'PASS') = vehicle_use_permitted),
  CHECK ((outcome = 'PASS' AND maintenance_urgency = 'ROUTINE') OR (outcome = 'CONCERN_REPORTED' AND maintenance_urgency = 'SAFETY_REVIEW') OR (outcome = 'FAIL' AND maintenance_urgency = 'DO_NOT_USE'))
);

DROP TRIGGER IF EXISTS vehicle_pre_shift_check_immutable ON vehicle_fleet.vehicle_pre_shift_check;
CREATE TRIGGER vehicle_pre_shift_check_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_pre_shift_check
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_defect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  reported_by_driver_profile_id uuid REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN ('DRIVER_PRE_SHIFT','DRIVER_OTHER','INSPECTION','MAINTENANCE_PROVIDER','TELEMATICS','RECALL','BREAKDOWN')),
  pre_shift_check_id uuid REFERENCES vehicle_fleet.vehicle_pre_shift_check(id) ON DELETE RESTRICT,
  category text NOT NULL,
  description text NOT NULL,
  reporter_safety_concern boolean NOT NULL,
  state vehicle_fleet.defect_state NOT NULL DEFAULT 'OPEN',
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  driver_fault_finding boolean NOT NULL DEFAULT false CHECK (driver_fault_finding = false),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((state IN ('RESOLVED','CLOSED') AND resolved_at IS NOT NULL) OR (state NOT IN ('RESOLVED','CLOSED') AND resolved_at IS NULL)),
  CHECK ((source_type = 'DRIVER_PRE_SHIFT') = (pre_shift_check_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_defect_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_defect_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_defect(id) ON DELETE RESTRICT,
  from_state vehicle_fleet.defect_state,
  to_state vehicle_fleet.defect_state NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_defect_id, version),
  CHECK ((version = 1 AND from_state IS NULL AND to_state = 'OPEN') OR (version > 1 AND from_state IS NOT NULL))
);

DROP TRIGGER IF EXISTS vehicle_defect_transition_immutable ON vehicle_fleet.vehicle_defect_transition;
CREATE TRIGGER vehicle_defect_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_defect_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_defect_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.reported_by_driver_profile_id IS DISTINCT FROM OLD.reported_by_driver_profile_id
     OR NEW.source_type IS DISTINCT FROM OLD.source_type OR NEW.pre_shift_check_id IS DISTINCT FROM OLD.pre_shift_check_id
     OR NEW.category IS DISTINCT FROM OLD.category OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.reporter_safety_concern IS DISTINCT FROM OLD.reporter_safety_concern
     OR NEW.driver_fault_finding IS DISTINCT FROM OLD.driver_fault_finding
     OR NEW.evidence_references IS DISTINCT FROM OLD.evidence_references OR NEW.reported_at IS DISTINCT FROM OLD.reported_at
  THEN RAISE EXCEPTION 'VehicleDefect report identity and evidence are immutable'; END IF;
  IF NEW.state = OLD.state THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'VehicleDefect version cannot change without a state transition'; END IF;
    IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN RAISE EXCEPTION 'VehicleDefect resolution time can change only with state'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.state
    WHEN 'OPEN' THEN NEW.state IN ('UNDER_REVIEW','REPAIR_REQUIRED','MONITORING','RESOLVED')
    WHEN 'UNDER_REVIEW' THEN NEW.state IN ('REPAIR_REQUIRED','MONITORING','RESOLVED')
    WHEN 'REPAIR_REQUIRED' THEN NEW.state IN ('UNDER_REVIEW','MONITORING','RESOLVED')
    WHEN 'MONITORING' THEN NEW.state IN ('UNDER_REVIEW','REPAIR_REQUIRED','RESOLVED')
    WHEN 'RESOLVED' THEN NEW.state IN ('CLOSED','UNDER_REVIEW')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid VehicleDefect transition % -> %', OLD.state, NEW.state; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'VehicleDefect transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_defect_state_guard ON vehicle_fleet.vehicle_defect;
CREATE TRIGGER vehicle_defect_state_guard
BEFORE UPDATE ON vehicle_fleet.vehicle_defect
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_defect_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_defect_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.state <> 'OPEN' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'VehicleDefect must begin OPEN at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.state = OLD.state AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_defect_transition transition
     WHERE transition.vehicle_defect_id = NEW.id AND transition.version = NEW.version
       AND transition.to_state = NEW.state
       AND transition.from_state IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.state END
  ) THEN RAISE EXCEPTION 'VehicleDefect current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_defect_history_guard ON vehicle_fleet.vehicle_defect;
CREATE CONSTRAINT TRIGGER vehicle_defect_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.vehicle_defect
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_defect_history();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_defect_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_defect_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_defect(id) ON DELETE RESTRICT,
  classification text NOT NULL CHECK (classification IN ('UNDETERMINED','NON_SAFETY','SERVICE_SPECIFIC','SAFETY_CRITICAL')),
  restricted_service_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  assessment_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(assessment_evidence_references) = 'array' AND jsonb_array_length(assessment_evidence_references) > 0),
  assessed_by_authority text NOT NULL,
  assessed_by_actor_id uuid,
  independent_from_reporter boolean NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((classification = 'SERVICE_SPECIFIC') = (cardinality(restricted_service_codes) > 0))
);

DROP TRIGGER IF EXISTS vehicle_defect_assessment_immutable ON vehicle_fleet.vehicle_defect_assessment;
CREATE TRIGGER vehicle_defect_assessment_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_defect_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE VIEW vehicle_fleet.current_vehicle_defect_assessment AS
SELECT DISTINCT ON (assessment.vehicle_defect_id) assessment.*
  FROM vehicle_fleet.vehicle_defect_assessment assessment
 ORDER BY assessment.vehicle_defect_id, assessment.assessed_at DESC, assessment.id DESC;

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_restriction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  source_defect_id uuid REFERENCES vehicle_fleet.vehicle_defect(id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('ALL_SERVICES','SERVICE_SPECIFIC')),
  restricted_service_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  urgency vehicle_fleet.maintenance_urgency NOT NULL CHECK (urgency IN ('SAFETY_REVIEW','DO_NOT_USE')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  precautionary_not_fault_finding boolean NOT NULL DEFAULT true CHECK (precautionary_not_fault_finding = true),
  prevents_dispatch boolean NOT NULL DEFAULT true CHECK (prevents_dispatch = true),
  reason_code text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'SERVICE_SPECIFIC') = (cardinality(restricted_service_codes) > 0)),
  CHECK ((status = 'ENDED') = (valid_until IS NOT NULL)),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_restriction_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_restriction_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_restriction(id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('ACTIVE','ENDED')),
  to_status text NOT NULL CHECK (to_status IN ('ACTIVE','ENDED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_restriction_id, version),
  CHECK ((version = 1 AND from_status IS NULL AND to_status = 'ACTIVE') OR (version > 1 AND from_status IS NOT NULL))
);

DROP TRIGGER IF EXISTS vehicle_restriction_transition_immutable ON vehicle_fleet.vehicle_restriction_transition;
CREATE TRIGGER vehicle_restriction_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_restriction_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_restriction_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.source_defect_id IS DISTINCT FROM OLD.source_defect_id
     OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.restricted_service_codes IS DISTINCT FROM OLD.restricted_service_codes
     OR NEW.urgency IS DISTINCT FROM OLD.urgency OR NEW.precautionary_not_fault_finding IS DISTINCT FROM OLD.precautionary_not_fault_finding
     OR NEW.prevents_dispatch IS DISTINCT FROM OLD.prevents_dispatch OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
     OR NEW.evidence_references IS DISTINCT FROM OLD.evidence_references OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'VehicleRestriction scope, reason and evidence are immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version OR NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
      RAISE EXCEPTION 'VehicleRestriction lifecycle facts require a status transition';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status <> 'ENDED' THEN
    RAISE EXCEPTION 'Invalid VehicleRestriction transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'VehicleRestriction transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_restriction_status_guard ON vehicle_fleet.vehicle_restriction;
CREATE TRIGGER vehicle_restriction_status_guard
BEFORE UPDATE ON vehicle_fleet.vehicle_restriction
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_restriction_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_restriction_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.status <> 'ACTIVE' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'VehicleRestriction must begin ACTIVE at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_restriction_transition transition
     WHERE transition.vehicle_restriction_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
       AND transition.from_status IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END
  ) THEN RAISE EXCEPTION 'VehicleRestriction current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_restriction_history_guard ON vehicle_fleet.vehicle_restriction;
CREATE CONSTRAINT TRIGGER vehicle_restriction_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.vehicle_restriction
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_restriction_history();

CREATE OR REPLACE VIEW vehicle_fleet.current_vehicle_restriction AS
SELECT restriction.* FROM vehicle_fleet.vehicle_restriction restriction
 WHERE restriction.status = 'ACTIVE' AND restriction.valid_from <= now()
   AND (restriction.valid_until IS NULL OR restriction.valid_until > now());

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','DIAGNOSIS','AWAITING_AUTHORISATION','REPAIR','QUALITY_REVIEW','RETURN_REVIEW','CLOSED','CANCELLED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  urgency vehicle_fleet.maintenance_urgency NOT NULL,
  assigned_provider_id uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK ((status IN ('CLOSED','CANCELLED')) = (closed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_case_defect (
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  vehicle_defect_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_defect(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (maintenance_case_id, vehicle_defect_id)
);

DROP TRIGGER IF EXISTS maintenance_case_defect_immutable ON vehicle_fleet.maintenance_case_defect;
CREATE TRIGGER maintenance_case_defect_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.maintenance_case_defect
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  provider_reference text NOT NULL UNIQUE,
  verification_status text NOT NULL CHECK (verification_status IN ('PENDING','VERIFIED','SUSPENDED','ENDED')),
  verification_evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(verification_evidence_references) = 'array'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verification_status <> 'VERIFIED' OR (verified_at IS NOT NULL AND jsonb_array_length(verification_evidence_references) > 0))
);

ALTER TABLE vehicle_fleet.maintenance_case
  ADD CONSTRAINT maintenance_case_provider_fk
  FOREIGN KEY (assigned_provider_id) REFERENCES vehicle_fleet.maintenance_provider(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_case_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('OPEN','DIAGNOSIS','AWAITING_AUTHORISATION','REPAIR','QUALITY_REVIEW','RETURN_REVIEW','CLOSED','CANCELLED')),
  to_status text NOT NULL CHECK (to_status IN ('OPEN','DIAGNOSIS','AWAITING_AUTHORISATION','REPAIR','QUALITY_REVIEW','RETURN_REVIEW','CLOSED','CANCELLED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maintenance_case_id, version),
  CHECK ((version = 1 AND from_status IS NULL AND to_status = 'OPEN') OR (version > 1 AND from_status IS NOT NULL))
);

DROP TRIGGER IF EXISTS maintenance_case_transition_immutable ON vehicle_fleet.maintenance_case_transition;
CREATE TRIGGER maintenance_case_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.maintenance_case_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_maintenance_case_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
    RAISE EXCEPTION 'MaintenanceCase vehicle and opening facts are immutable';
  END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version OR NEW.urgency IS DISTINCT FROM OLD.urgency
       OR NEW.assigned_provider_id IS DISTINCT FROM OLD.assigned_provider_id
       OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
    THEN RAISE EXCEPTION 'MaintenanceCase operational facts require a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'OPEN' THEN NEW.status IN ('DIAGNOSIS','CANCELLED')
    WHEN 'DIAGNOSIS' THEN NEW.status IN ('AWAITING_AUTHORISATION','REPAIR','QUALITY_REVIEW','CANCELLED')
    WHEN 'AWAITING_AUTHORISATION' THEN NEW.status IN ('DIAGNOSIS','REPAIR','CANCELLED')
    WHEN 'REPAIR' THEN NEW.status IN ('DIAGNOSIS','QUALITY_REVIEW')
    WHEN 'QUALITY_REVIEW' THEN NEW.status IN ('REPAIR','RETURN_REVIEW')
    WHEN 'RETURN_REVIEW' THEN NEW.status IN ('REPAIR','QUALITY_REVIEW','CLOSED')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid MaintenanceCase transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'MaintenanceCase transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS maintenance_case_status_guard ON vehicle_fleet.maintenance_case;
CREATE TRIGGER maintenance_case_status_guard
BEFORE UPDATE ON vehicle_fleet.maintenance_case
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_maintenance_case_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_maintenance_case_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.status <> 'OPEN' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'MaintenanceCase must begin OPEN at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.maintenance_case_transition transition
     WHERE transition.maintenance_case_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
       AND transition.from_status IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END
  ) THEN RAISE EXCEPTION 'MaintenanceCase current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS maintenance_case_history_guard ON vehicle_fleet.maintenance_case;
CREATE CONSTRAINT TRIGGER maintenance_case_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.maintenance_case
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_maintenance_case_history();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_recall_notice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  recall_reference text NOT NULL,
  source_authority text NOT NULL,
  safety_critical boolean NOT NULL,
  required_action text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  published_at timestamptz NOT NULL,
  UNIQUE (vehicle_id, recall_reference)
);

DROP TRIGGER IF EXISTS vehicle_recall_notice_immutable ON vehicle_fleet.vehicle_recall_notice;
CREATE TRIGGER vehicle_recall_notice_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_recall_notice
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_recall_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_notice_id uuid NOT NULL UNIQUE REFERENCES vehicle_fleet.vehicle_recall_notice(id) ON DELETE RESTRICT,
  resolution_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(resolution_evidence_references) = 'array' AND jsonb_array_length(resolution_evidence_references) > 0),
  resolved_by_authority text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vehicle_recall_resolution_immutable ON vehicle_fleet.vehicle_recall_resolution;
CREATE TRIGGER vehicle_recall_resolution_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_recall_resolution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.warranty_evaluation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('COVERED','PARTIALLY_COVERED','NOT_COVERED','STATUS_UNKNOWN')),
  warranty_reference text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  evaluated_by_authority text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS warranty_evaluation_immutable ON vehicle_fleet.warranty_evaluation;
CREATE TRIGGER warranty_evaluation_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.warranty_evaluation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.repair_estimate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_provider(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  scope_items jsonb NOT NULL CHECK (jsonb_typeof(scope_items) = 'array' AND jsonb_array_length(scope_items) > 0),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > issued_at)
);

DROP TRIGGER IF EXISTS repair_estimate_immutable ON vehicle_fleet.repair_estimate;
CREATE TRIGGER repair_estimate_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.repair_estimate
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.repair_authorisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  repair_estimate_id uuid NOT NULL REFERENCES vehicle_fleet.repair_estimate(id) ON DELETE RESTRICT,
  warranty_evaluation_id uuid NOT NULL REFERENCES vehicle_fleet.warranty_evaluation(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED','MORE_EVIDENCE_REQUIRED')),
  decision_authority text NOT NULL,
  decision_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(decision_evidence_references) = 'array' AND jsonb_array_length(decision_evidence_references) > 0),
  decided_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS repair_authorisation_immutable ON vehicle_fleet.repair_authorisation;
CREATE TRIGGER repair_authorisation_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.repair_authorisation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_warranty_first_repair_authorisation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.repair_estimate estimate
    JOIN vehicle_fleet.warranty_evaluation warranty ON warranty.id = NEW.warranty_evaluation_id
     WHERE estimate.id = NEW.repair_estimate_id
       AND estimate.maintenance_case_id = NEW.maintenance_case_id
       AND warranty.maintenance_case_id = NEW.maintenance_case_id
       AND warranty.evaluated_at <= NEW.decided_at
  ) THEN RAISE EXCEPTION 'Repair authorisation requires a matching estimate and prior warranty evaluation'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS warranty_first_repair_authorisation_guard ON vehicle_fleet.repair_authorisation;
CREATE CONSTRAINT TRIGGER warranty_first_repair_authorisation_guard
AFTER INSERT ON vehicle_fleet.repair_authorisation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_warranty_first_repair_authorisation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.repair_invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  repair_authorisation_id uuid REFERENCES vehicle_fleet.repair_authorisation(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_provider(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  completed_scope_items jsonb NOT NULL CHECK (jsonb_typeof(completed_scope_items) = 'array' AND jsonb_array_length(completed_scope_items) > 0),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  issued_at timestamptz NOT NULL
);

DROP TRIGGER IF EXISTS repair_invoice_immutable ON vehicle_fleet.repair_invoice;
CREATE TRIGGER repair_invoice_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.repair_invoice
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

COMMENT ON TABLE vehicle_fleet.repair_estimate IS 'Pre-repair commercial estimate; it is never rewritten into or treated as the final invoice.';
COMMENT ON TABLE vehicle_fleet.repair_invoice IS 'Final invoice truth remains distinct from RepairEstimate and requires its own completed scope evidence.';

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_completion_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  repair_invoice_id uuid REFERENCES vehicle_fleet.repair_invoice(id) ON DELETE RESTRICT,
  completed_work jsonb NOT NULL CHECK (jsonb_typeof(completed_work) = 'array' AND jsonb_array_length(completed_work) > 0),
  completion_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(completion_evidence_references) = 'array' AND jsonb_array_length(completion_evidence_references) > 0),
  completed_by_provider_id uuid REFERENCES vehicle_fleet.maintenance_provider(id) ON DELETE RESTRICT,
  completed_at timestamptz NOT NULL
);

DROP TRIGGER IF EXISTS maintenance_completion_record_immutable ON vehicle_fleet.maintenance_completion_record;
CREATE TRIGGER maintenance_completion_record_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.maintenance_completion_record
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.post_maintenance_inspection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('PASSED','FAILED','MORE_EVIDENCE_REQUIRED')),
  independent_inspector boolean NOT NULL,
  inspector_authority text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  inspected_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS post_maintenance_inspection_immutable ON vehicle_fleet.post_maintenance_inspection;
CREATE TRIGGER post_maintenance_inspection_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.post_maintenance_inspection
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.return_to_service_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_case_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  completion_record_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_completion_record(id) ON DELETE RESTRICT,
  inspection_id uuid NOT NULL REFERENCES vehicle_fleet.post_maintenance_inspection(id) ON DELETE RESTRICT,
  vehicle_state_transition_id uuid REFERENCES vehicle_fleet.vehicle_state_transition(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('APPROVED','REJECTED','MORE_EVIDENCE_REQUIRED')),
  independent_reviewer boolean NOT NULL,
  decision_authority text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((decision = 'APPROVED') = (vehicle_state_transition_id IS NOT NULL))
);

DROP TRIGGER IF EXISTS return_to_service_decision_immutable ON vehicle_fleet.return_to_service_decision;
CREATE TRIGGER return_to_service_decision_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.return_to_service_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_return_to_service_decision()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_vehicle_id uuid;
BEGIN
  SELECT maintenance_case.vehicle_id INTO case_vehicle_id
    FROM vehicle_fleet.maintenance_case maintenance_case WHERE maintenance_case.id = NEW.maintenance_case_id;
  IF NEW.decision = 'APPROVED' AND (
    NEW.independent_reviewer <> true
    OR NOT EXISTS (
      SELECT 1 FROM vehicle_fleet.maintenance_completion_record completion
       WHERE completion.id = NEW.completion_record_id AND completion.maintenance_case_id = NEW.maintenance_case_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM vehicle_fleet.post_maintenance_inspection inspection
       WHERE inspection.id = NEW.inspection_id AND inspection.maintenance_case_id = NEW.maintenance_case_id
         AND inspection.result = 'PASSED' AND inspection.independent_inspector = true
    )
    OR EXISTS (
      SELECT 1 FROM vehicle_fleet.current_vehicle_restriction restriction
       WHERE restriction.vehicle_id = case_vehicle_id
    )
    OR EXISTS (
      SELECT 1 FROM vehicle_fleet.vehicle_defect defect
      JOIN vehicle_fleet.current_vehicle_defect_assessment assessment ON assessment.vehicle_defect_id = defect.id
       WHERE defect.vehicle_id = case_vehicle_id AND defect.state NOT IN ('RESOLVED','CLOSED')
         AND assessment.classification = 'SAFETY_CRITICAL'
    )
    OR EXISTS (
      SELECT 1 FROM vehicle_fleet.current_maintenance_requirement requirement
       WHERE requirement.vehicle_id = case_vehicle_id AND requirement.status IN ('OPEN','SCHEDULED','IN_PROGRESS')
         AND requirement.urgency IN ('SAFETY_REVIEW','DO_NOT_USE')
    )
    OR NOT EXISTS (
      SELECT 1 FROM vehicle_fleet.vehicle_state_transition transition
      JOIN vehicle_fleet.vehicle vehicle ON vehicle.id = transition.vehicle_id
       WHERE transition.id = NEW.vehicle_state_transition_id AND transition.vehicle_id = case_vehicle_id
         AND transition.to_state = 'AVAILABLE' AND vehicle.fleet_state = 'AVAILABLE'
         AND vehicle.fleet_state_version = transition.version
    )
  ) THEN RAISE EXCEPTION 'ReturnToService approval requires completed work, independent passed inspection, cleared hard blockers and matching current AVAILABLE transition'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS return_to_service_decision_guard ON vehicle_fleet.return_to_service_decision;
CREATE CONSTRAINT TRIGGER return_to_service_decision_guard
AFTER INSERT ON vehicle_fleet.return_to_service_decision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_return_to_service_decision();

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_provider_quality_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES vehicle_fleet.maintenance_provider(id) ON DELETE RESTRICT,
  maintenance_case_id uuid REFERENCES vehicle_fleet.maintenance_case(id) ON DELETE RESTRICT,
  observation_type text NOT NULL CHECK (observation_type IN ('ON_TIME','LATE','FIRST_TIME_FIX','REPEAT_REPAIR','QUALITY_CONCERN','WARRANTY_HANDLING')),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  observed_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS maintenance_provider_quality_observation_immutable ON vehicle_fleet.maintenance_provider_quality_observation;
CREATE TRIGGER maintenance_provider_quality_observation_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.maintenance_provider_quality_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.repeat_defect_signal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  category text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.repeat_defect_signal_defect (
  repeat_defect_signal_id uuid NOT NULL REFERENCES vehicle_fleet.repeat_defect_signal(id) ON DELETE RESTRICT,
  vehicle_defect_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_defect(id) ON DELETE RESTRICT,
  PRIMARY KEY (repeat_defect_signal_id, vehicle_defect_id)
);

DROP TRIGGER IF EXISTS repeat_defect_signal_defect_immutable ON vehicle_fleet.repeat_defect_signal_defect;
CREATE TRIGGER repeat_defect_signal_defect_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.repeat_defect_signal_defect
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_repeat_defect_signal_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM vehicle_fleet.repeat_defect_signal_defect link WHERE link.repeat_defect_signal_id = NEW.id) < 2 THEN
    RAISE EXCEPTION 'Repeat-defect signal requires at least two preserved VehicleDefect records';
  END IF;
  IF EXISTS (
    SELECT 1 FROM vehicle_fleet.repeat_defect_signal_defect link
    JOIN vehicle_fleet.vehicle_defect defect ON defect.id = link.vehicle_defect_id
     WHERE link.repeat_defect_signal_id = NEW.id AND defect.vehicle_id <> NEW.vehicle_id
  ) THEN RAISE EXCEPTION 'Repeat-defect signal evidence must belong to the same vehicle'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS repeat_defect_signal_evidence_guard ON vehicle_fleet.repeat_defect_signal;
CREATE CONSTRAINT TRIGGER repeat_defect_signal_evidence_guard
AFTER INSERT ON vehicle_fleet.repeat_defect_signal
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_repeat_defect_signal_evidence();

CREATE TABLE IF NOT EXISTS rescue.breakdown_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  driver_profile_id uuid REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  passenger_continuity_case_id uuid REFERENCES journey.continuity_case(id) ON DELETE RESTRICT,
  source_reference text NOT NULL,
  description text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  driver_neglect_finding boolean NOT NULL DEFAULT false CHECK (driver_neglect_finding = false),
  reported_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS breakdown_event_immutable ON rescue.breakdown_event;
CREATE TRIGGER breakdown_event_immutable
BEFORE UPDATE OR DELETE ON rescue.breakdown_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_replacement_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  unavailable_vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  source_defect_id uuid REFERENCES vehicle_fleet.vehicle_defect(id) ON DELETE RESTRICT,
  source_breakdown_event_id uuid REFERENCES rescue.breakdown_event(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('REQUESTED','MATCHING','READY','ASSIGNED','CLOSED','CANCELLED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  reporting_penalty_applied boolean NOT NULL DEFAULT false CHECK (reporting_penalty_applied = false),
  defect_hiding_incentive_allowed boolean NOT NULL DEFAULT false CHECK (defect_hiding_incentive_allowed = false),
  requested_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source_defect_id IS NOT NULL) <> (source_breakdown_event_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_replacement_request_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  replacement_request_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_replacement_request(id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('REQUESTED','MATCHING','READY','ASSIGNED','CLOSED','CANCELLED')),
  to_status text NOT NULL CHECK (to_status IN ('REQUESTED','MATCHING','READY','ASSIGNED','CLOSED','CANCELLED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (replacement_request_id, version),
  CHECK ((version = 1 AND from_status IS NULL AND to_status = 'REQUESTED') OR (version > 1 AND from_status IS NOT NULL))
);

DROP TRIGGER IF EXISTS replacement_request_transition_immutable ON vehicle_fleet.vehicle_replacement_request_transition;
CREATE TRIGGER replacement_request_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_replacement_request_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_replacement_request_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.driver_profile_id IS DISTINCT FROM OLD.driver_profile_id
     OR NEW.unavailable_vehicle_id IS DISTINCT FROM OLD.unavailable_vehicle_id
     OR NEW.source_defect_id IS DISTINCT FROM OLD.source_defect_id
     OR NEW.source_breakdown_event_id IS DISTINCT FROM OLD.source_breakdown_event_id
     OR NEW.reporting_penalty_applied IS DISTINCT FROM OLD.reporting_penalty_applied
     OR NEW.defect_hiding_incentive_allowed IS DISTINCT FROM OLD.defect_hiding_incentive_allowed
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
  THEN RAISE EXCEPTION 'Replacement request source and no-penalty facts are immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'Replacement request version requires a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'REQUESTED' THEN NEW.status IN ('MATCHING','CANCELLED')
    WHEN 'MATCHING' THEN NEW.status IN ('READY','CANCELLED')
    WHEN 'READY' THEN NEW.status IN ('ASSIGNED','MATCHING','CANCELLED')
    WHEN 'ASSIGNED' THEN NEW.status = 'CLOSED'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid replacement request transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'Replacement request transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS replacement_request_status_guard ON vehicle_fleet.vehicle_replacement_request;
CREATE TRIGGER replacement_request_status_guard
BEFORE UPDATE ON vehicle_fleet.vehicle_replacement_request
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_replacement_request_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_replacement_request_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.status <> 'REQUESTED' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'Replacement request must begin REQUESTED at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_replacement_request_transition transition
     WHERE transition.replacement_request_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
       AND transition.from_status IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END
  ) THEN RAISE EXCEPTION 'Replacement request current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS replacement_request_history_guard ON vehicle_fleet.vehicle_replacement_request;
CREATE CONSTRAINT TRIGGER replacement_request_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.vehicle_replacement_request
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_replacement_request_history();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_reliability_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  observation_type text NOT NULL CHECK (observation_type IN ('BREAKDOWN','DOWNTIME','REPEAT_DEFECT','RECALL','RETURN_TO_SERVICE')),
  source_reference_id uuid NOT NULL,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  driver_compliance_finding boolean NOT NULL DEFAULT false CHECK (driver_compliance_finding = false),
  observed_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vehicle_reliability_observation_immutable ON vehicle_fleet.vehicle_reliability_observation;
CREATE TRIGGER vehicle_reliability_observation_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_reliability_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.maintenance_compliance_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('COMPLIANT','ACTION_REQUIRED','UNDER_REVIEW','NON_COMPLIANT')),
  derived_from_breakdown_alone boolean NOT NULL DEFAULT false CHECK (derived_from_breakdown_alone = false),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  assessed_by_authority text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS maintenance_compliance_assessment_immutable ON driver.maintenance_compliance_assessment;
CREATE TRIGGER maintenance_compliance_assessment_immutable
BEFORE UPDATE OR DELETE ON driver.maintenance_compliance_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.driver_perks_programme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_name text NOT NULL,
  region_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_name, region_code)
);

CREATE TABLE IF NOT EXISTS driver.driver_perk_offer_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES driver.driver_perks_programme(id) ON DELETE RESTRICT,
  offer_family_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  supersedes_offer_version_id uuid REFERENCES driver.driver_perk_offer_version(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('FUEL','CHARGING','TYRES','SERVICING','INSURANCE','INSPECTION','TRAINING')),
  status text NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','PAUSED','WITHDRAWN','EXPIRED')),
  provider_reference text NOT NULL,
  provider_verified_at timestamptz,
  benefit_terms text[] NOT NULL,
  eligibility_terms text[] NOT NULL,
  redemption_route text NOT NULL,
  verification_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(verification_evidence_references) = 'array'),
  verified_before_marketing boolean NOT NULL DEFAULT true CHECK (verified_before_marketing = true),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_family_id, version),
  CHECK ((version = 1 AND supersedes_offer_version_id IS NULL) OR (version > 1 AND supersedes_offer_version_id IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (status <> 'PUBLISHED' OR (
    provider_verified_at IS NOT NULL AND cardinality(benefit_terms) > 0
    AND cardinality(eligibility_terms) > 0 AND length(trim(redemption_route)) > 0
    AND jsonb_array_length(verification_evidence_references) > 0
  ))
);

DROP TRIGGER IF EXISTS driver_perk_offer_version_immutable ON driver.driver_perk_offer_version;
CREATE TRIGGER driver_perk_offer_version_immutable
BEFORE UPDATE OR DELETE ON driver.driver_perk_offer_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE UNIQUE INDEX IF NOT EXISTS driver_perk_offer_one_successor
  ON driver.driver_perk_offer_version (supersedes_offer_version_id) WHERE supersedes_offer_version_id IS NOT NULL;

CREATE OR REPLACE FUNCTION driver.guard_perk_offer_version_chain()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM driver.driver_perk_offer_version prior
     WHERE prior.id = NEW.supersedes_offer_version_id AND prior.offer_family_id = NEW.offer_family_id
       AND prior.programme_id = NEW.programme_id AND prior.version = NEW.version - 1
  ) THEN RAISE EXCEPTION 'Driver perk offer version must directly supersede its prior family version'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_perk_offer_version_chain_guard ON driver.driver_perk_offer_version;
CREATE CONSTRAINT TRIGGER driver_perk_offer_version_chain_guard
AFTER INSERT ON driver.driver_perk_offer_version
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_perk_offer_version_chain();

CREATE OR REPLACE VIEW driver.current_verified_perk_offer AS
SELECT offer.id AS perk_offer_id, programme.programme_name, programme.region_code,
       offer.offer_family_id, offer.version, offer.category, offer.provider_reference,
       offer.provider_verified_at, offer.benefit_terms, offer.eligibility_terms,
       offer.redemption_route, offer.effective_from, offer.effective_until
  FROM driver.driver_perk_offer_version offer
  JOIN driver.driver_perks_programme programme ON programme.id = offer.programme_id
 WHERE programme.status = 'ACTIVE' AND offer.status = 'PUBLISHED'
   AND offer.version = (
     SELECT max(latest.version) FROM driver.driver_perk_offer_version latest
      WHERE latest.offer_family_id = offer.offer_family_id
   ) AND offer.provider_verified_at IS NOT NULL AND offer.provider_verified_at <= now()
   AND offer.effective_from <= now()
   AND (offer.effective_until IS NULL OR offer.effective_until > now());

CREATE TABLE IF NOT EXISTS vehicle_fleet.whole_life_cost_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  vehicle_class_reference text,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  acquisition_minor bigint NOT NULL CHECK (acquisition_minor >= 0 AND acquisition_minor <= 9007199254740991),
  depreciation_minor bigint NOT NULL CHECK (depreciation_minor >= 0 AND depreciation_minor <= 9007199254740991),
  insurance_minor bigint NOT NULL CHECK (insurance_minor >= 0 AND insurance_minor <= 9007199254740991),
  service_minor bigint NOT NULL CHECK (service_minor >= 0 AND service_minor <= 9007199254740991),
  repair_minor bigint NOT NULL CHECK (repair_minor >= 0 AND repair_minor <= 9007199254740991),
  tyres_minor bigint NOT NULL CHECK (tyres_minor >= 0 AND tyres_minor <= 9007199254740991),
  energy_minor bigint NOT NULL CHECK (energy_minor >= 0 AND energy_minor <= 9007199254740991),
  downtime_minor bigint NOT NULL CHECK (downtime_minor >= 0 AND downtime_minor <= 9007199254740991),
  resale_minor bigint NOT NULL CHECK (resale_minor >= 0 AND resale_minor <= 9007199254740991),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  brochure_price_only boolean NOT NULL DEFAULT false CHECK (brochure_price_only = false),
  evaluation_period_start date NOT NULL,
  evaluation_period_end date NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((vehicle_id IS NOT NULL) <> (vehicle_class_reference IS NOT NULL)),
  CHECK (evaluation_period_end > evaluation_period_start)
);

DROP TRIGGER IF EXISTS whole_life_cost_evidence_immutable ON vehicle_fleet.whole_life_cost_evidence;
CREATE TRIGGER whole_life_cost_evidence_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.whole_life_cost_evidence
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE VIEW vehicle_fleet.current_vehicle_maintenance_gate AS
WITH requirement_summary AS (
  SELECT requirement.vehicle_id,
         count(*) FILTER (WHERE requirement.status IN ('OPEN','SCHEDULED','IN_PROGRESS')) AS current_requirement_count,
         max(CASE requirement.urgency
           WHEN 'ROUTINE' THEN 1 WHEN 'DUE_SOON' THEN 2 WHEN 'OVERDUE' THEN 3
           WHEN 'SAFETY_REVIEW' THEN 4 WHEN 'DO_NOT_USE' THEN 5 END)
           FILTER (WHERE requirement.status IN ('OPEN','SCHEDULED','IN_PROGRESS')) AS urgency_rank
    FROM vehicle_fleet.current_maintenance_requirement requirement GROUP BY requirement.vehicle_id
), restriction_summary AS (
  SELECT restriction.vehicle_id,
         bool_or(restriction.scope = 'ALL_SERVICES') AS all_services_restricted,
         COALESCE(array_agg(DISTINCT service_code.service_code)
           FILTER (WHERE service_code.service_code IS NOT NULL), ARRAY[]::text[]) AS restricted_service_codes,
         array_agg(DISTINCT restriction.id ORDER BY restriction.id) AS active_restriction_ids
    FROM vehicle_fleet.current_vehicle_restriction restriction
    LEFT JOIN LATERAL unnest(restriction.restricted_service_codes) service_code(service_code) ON true
   GROUP BY restriction.vehicle_id
), recall_summary AS (
  SELECT recall.vehicle_id, true AS unresolved_safety_critical_recall
    FROM vehicle_fleet.vehicle_recall_notice recall
   WHERE recall.safety_critical = true AND NOT EXISTS (
     SELECT 1 FROM vehicle_fleet.vehicle_recall_resolution resolution
      WHERE resolution.recall_notice_id = recall.id
   )
   GROUP BY recall.vehicle_id
)
SELECT vehicle.id AS vehicle_id, plan.plan_version_id,
       plan.plan_version_id IS NOT NULL AS active_plan_present,
       COALESCE(requirements.current_requirement_count, 0) > 0 AS active_requirements_present,
       CASE requirements.urgency_rank
         WHEN 1 THEN 'ROUTINE'::vehicle_fleet.maintenance_urgency
         WHEN 2 THEN 'DUE_SOON'::vehicle_fleet.maintenance_urgency
         WHEN 3 THEN 'OVERDUE'::vehicle_fleet.maintenance_urgency
         WHEN 4 THEN 'SAFETY_REVIEW'::vehicle_fleet.maintenance_urgency
         WHEN 5 THEN 'DO_NOT_USE'::vehicle_fleet.maintenance_urgency
       END AS highest_urgency,
       COALESCE(restrictions.all_services_restricted, false) AS all_services_restricted,
       COALESCE(restrictions.restricted_service_codes, ARRAY[]::text[]) AS restricted_service_codes,
       COALESCE(restrictions.active_restriction_ids, ARRAY[]::uuid[]) AS active_restriction_ids,
       COALESCE(recalls.unresolved_safety_critical_recall, false) AS unresolved_safety_critical_recall,
       (
         plan.plan_version_id IS NOT NULL AND COALESCE(requirements.current_requirement_count, 0) > 0
         AND COALESCE(requirements.urgency_rank, 1) < 4
         AND NOT COALESCE(restrictions.all_services_restricted, false)
         AND NOT COALESCE(recalls.unresolved_safety_critical_recall, false)
       ) AS operating_permitted,
       (plan.plan_version_id IS NULL OR COALESCE(requirements.current_requirement_count, 0) = 0
         OR COALESCE(requirements.urgency_rank, 1) >= 2 OR COALESCE(restrictions.all_services_restricted, false)
         OR COALESCE(recalls.unresolved_safety_critical_recall, false)
         OR cardinality(COALESCE(restrictions.restricted_service_codes, ARRAY[]::text[])) > 0) AS action_required
  FROM vehicle_fleet.vehicle vehicle
  LEFT JOIN vehicle_fleet.current_vehicle_maintenance_plan plan ON plan.vehicle_id = vehicle.id
  LEFT JOIN requirement_summary requirements ON requirements.vehicle_id = vehicle.id
  LEFT JOIN restriction_summary restrictions ON restrictions.vehicle_id = vehicle.id
  LEFT JOIN recall_summary recalls ON recalls.vehicle_id = vehicle.id;

CREATE OR REPLACE VIEW vehicle_fleet.current_marketplace_offer AS
SELECT offer.id AS offer_id, offer.offer_family_id, offer.version, offer.vehicle_id,
       offer.fleet_organisation_id, offer.region_code, offer.access_route, offer.tier,
       offer.periodic_charge_minor, offer.total_contract_cost_minor, offer.deposit_minor,
       offer.currency, offer.billing_interval, offer.term_days, offer.mileage_terms,
       offer.end_of_term_conditions, offer.included_services, offer.excluded_services,
       offer.ownership_transfer_terms, offer.supplier_stock_verified_at, offer.warranty_verified_at,
       offer.effective_from, offer.effective_until
  FROM vehicle_fleet.marketplace_offer offer
  JOIN vehicle_fleet.vehicle vehicle ON vehicle.id = offer.vehicle_id
  JOIN vehicle_fleet.current_vehicle_capability capability ON capability.vehicle_id = offer.vehicle_id
    AND capability.valid_until > now()
  JOIN vehicle_fleet.current_vehicle_maintenance_gate maintenance ON maintenance.vehicle_id = offer.vehicle_id
    AND maintenance.operating_permitted = true
  LEFT JOIN vehicle_fleet.fleet_organisation fleet_organisation ON fleet_organisation.id = offer.fleet_organisation_id
  JOIN LATERAL (
    SELECT status, valid_until FROM compliance.vehicle_eligibility_snapshot snapshot
     WHERE snapshot.vehicle_id = offer.vehicle_id ORDER BY snapshot.evaluated_at DESC LIMIT 1
  ) eligibility ON true
 WHERE offer.status = 'PUBLISHED' AND offer.effective_from <= now()
   AND (offer.effective_until IS NULL OR offer.effective_until > now())
   AND offer.version = (
     SELECT max(latest.version) FROM vehicle_fleet.marketplace_offer latest
      WHERE latest.offer_family_id = offer.offer_family_id
   )
   AND (offer.access_route = 'DRIVER_OWNED' OR fleet_organisation.status = 'ACTIVE')
   AND vehicle.fleet_state = 'AVAILABLE'
   AND eligibility.status = 'ELIGIBLE' AND eligibility.valid_until > now();

ALTER TABLE vehicle_fleet.vehicle_assignment_validation_snapshot
  ADD COLUMN IF NOT EXISTS maintenance_plan_current boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_operating_permitted boolean NOT NULL DEFAULT false;

ALTER TABLE vehicle_fleet.vehicle_assignment_validation_snapshot
  ADD CONSTRAINT vehicle_assignment_validation_maintenance_gate
  CHECK (hard_checks_passed = false OR (maintenance_plan_current AND maintenance_operating_permitted));

ALTER TABLE dispatch.candidate_snapshot
  ADD COLUMN IF NOT EXISTS vehicle_maintenance_plan_version_id uuid REFERENCES vehicle_fleet.vehicle_maintenance_plan_version(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS vehicle_restriction_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE TABLE IF NOT EXISTS vehicle_fleet.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  actor_id uuid NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, actor_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.maintenance_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'maintenance.pre-shift-check-recorded','maintenance.defect-reported',
    'maintenance.vehicle-restricted','maintenance.replacement-requested',
    'maintenance.return-to-service-decided','maintenance.recall-recorded'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
);

CREATE INDEX IF NOT EXISTS maintenance_outbox_unpublished_idx
  ON vehicle_fleet.maintenance_outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE vehicle_fleet.vehicle_pre_shift_check IS 'Concise Driver observation. Core roadworthiness items cannot be not-applicable. NOT_SURE and free-text concern require no diagnosis and create no Driver fault finding.';
COMMENT ON TABLE vehicle_fleet.vehicle_reliability_observation IS 'Vehicle reliability evidence is separate from Driver maintenance compliance and cannot itself create a Driver finding.';
COMMENT ON TABLE rescue.breakdown_event IS 'Breakdown alone is not proof of Driver neglect; active-Journey passenger continuity remains a separate Journey ContinuityCase.';
COMMENT ON TABLE vehicle_fleet.vehicle_replacement_request IS 'Replacement workflow must reduce incentives to hide defects and never penalise the act of reporting one.';
COMMENT ON VIEW driver.current_verified_perk_offer IS 'Only current, provider-verified benefit terms may be marketed as a Driver perk.';
COMMENT ON TABLE vehicle_fleet.whole_life_cost_evidence IS 'Acquisition, depreciation, insurance, service, repair, tyres, energy, downtime and resale evidence; brochure price alone is prohibited.';
