-- DAZAT Mobility — Engineering Phase 0.8
-- Driver onboarding, document provenance, assessed competency, scoped permission and restriction truth.
-- A Driver cannot self-approve; OCR/extraction is never authoritative verification.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='driver' AND t.typname='application_status') THEN
    CREATE TYPE driver.application_status AS ENUM (
      'STARTED','CONTACT_VERIFIED','IDENTITY_PENDING','DOCUMENTS_PENDING','TRAINING_PENDING',
      'VEHICLE_PENDING','REVIEW_PENDING','APPROVED','DECLINED','WITHDRAWN','EXPIRED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='driver' AND t.typname='operating_eligibility_status') THEN
    CREATE TYPE driver.operating_eligibility_status AS ENUM ('ELIGIBLE','PARTIALLY_ELIGIBLE','NOT_ELIGIBLE');
  END IF;
END $$;

ALTER TABLE driver.driver_profile DROP CONSTRAINT IF EXISTS driver_profile_onboarding_status_check;
ALTER TABLE driver.driver_profile ADD CONSTRAINT driver_profile_onboarding_status_check CHECK (
  onboarding_status IN ('NOT_STARTED','STARTED','CONTACT_VERIFIED','IDENTITY_PENDING','DOCUMENTS_PENDING',
    'TRAINING_PENDING','VEHICLE_PENDING','REVIEW_PENDING','APPROVED','DECLINED','WITHDRAWN','EXPIRED')
);

CREATE TABLE IF NOT EXISTS driver.driver_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  status driver.application_status NOT NULL DEFAULT 'STARTED',
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  policy_version text NOT NULL,
  submitted_at timestamptz,
  decided_at timestamptz,
  decision_reason_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status IN ('APPROVED','DECLINED') AND decided_at IS NOT NULL) OR (status NOT IN ('APPROVED','DECLINED') AND decided_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_one_active_application
  ON driver.driver_application (driver_profile_id)
  WHERE status NOT IN ('APPROVED','DECLINED','WITHDRAWN','EXPIRED');

CREATE TABLE IF NOT EXISTS driver.driver_application_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_application_id uuid NOT NULL REFERENCES driver.driver_application(id) ON DELETE RESTRICT,
  from_status driver.application_status,
  to_status driver.application_status NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('DRIVER_SELF_SERVICE','SYSTEM','AUTHORISED_STAFF','APPROVED_PROVIDER')),
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_application_id, version),
  UNIQUE (command_id)
);

DROP TRIGGER IF EXISTS driver_application_transition_immutable ON driver.driver_application_transition;
CREATE TRIGGER driver_application_transition_immutable
BEFORE UPDATE OR DELETE ON driver.driver_application_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.driver_application_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_application_id uuid NOT NULL UNIQUE REFERENCES driver.driver_application(id) ON DELETE RESTRICT,
  decision driver.application_status NOT NULL CHECK (decision IN ('APPROVED','DECLINED')),
  decision_authority_type text NOT NULL CHECK (decision_authority_type IN ('AUTHORISED_STAFF','APPROVED_PROVIDER')),
  reviewer_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  provider_decision_reference text,
  reason_code text NOT NULL,
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_version text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (decision_authority_type = 'AUTHORISED_STAFF' AND reviewer_person_id IS NOT NULL AND provider_decision_reference IS NULL)
    OR (decision_authority_type = 'APPROVED_PROVIDER' AND reviewer_person_id IS NULL AND provider_decision_reference IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS driver_application_decision_immutable ON driver.driver_application_decision;
CREATE TRIGGER driver_application_decision_immutable
BEFORE UPDATE OR DELETE ON driver.driver_application_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION driver.guard_application_decision_context()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_application a
    JOIN driver.driver_profile profile ON profile.id = a.driver_profile_id
     WHERE a.id = NEW.driver_application_id AND a.status = NEW.decision
       AND a.decided_at = NEW.decided_at AND a.decision_reason_code = NEW.reason_code
       AND (NEW.reviewer_person_id IS NULL OR NEW.reviewer_person_id <> profile.person_id)
  ) THEN RAISE EXCEPTION 'Authorised DriverApplication decision must match committed terminal application truth'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_application_decision_context_guard ON driver.driver_application_decision;
CREATE CONSTRAINT TRIGGER driver_application_decision_context_guard
AFTER INSERT ON driver.driver_application_decision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_application_decision_context();

CREATE OR REPLACE FUNCTION driver.guard_application_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'DriverApplication version cannot change without a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'STARTED' THEN NEW.status IN ('CONTACT_VERIFIED','WITHDRAWN','EXPIRED')
    WHEN 'CONTACT_VERIFIED' THEN NEW.status IN ('IDENTITY_PENDING','WITHDRAWN','EXPIRED')
    WHEN 'IDENTITY_PENDING' THEN NEW.status IN ('DOCUMENTS_PENDING','DECLINED','WITHDRAWN','EXPIRED')
    WHEN 'DOCUMENTS_PENDING' THEN NEW.status IN ('TRAINING_PENDING','VEHICLE_PENDING','REVIEW_PENDING','DECLINED','WITHDRAWN','EXPIRED')
    WHEN 'TRAINING_PENDING' THEN NEW.status IN ('DOCUMENTS_PENDING','VEHICLE_PENDING','REVIEW_PENDING','DECLINED','WITHDRAWN','EXPIRED')
    WHEN 'VEHICLE_PENDING' THEN NEW.status IN ('DOCUMENTS_PENDING','TRAINING_PENDING','REVIEW_PENDING','DECLINED','WITHDRAWN','EXPIRED')
    WHEN 'REVIEW_PENDING' THEN NEW.status IN ('DOCUMENTS_PENDING','TRAINING_PENDING','VEHICLE_PENDING','APPROVED','DECLINED','WITHDRAWN','EXPIRED')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid DriverApplication transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'DriverApplication transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_application_status_guard ON driver.driver_application;
CREATE TRIGGER driver_application_status_guard
BEFORE UPDATE OF status, version ON driver.driver_application
FOR EACH ROW EXECUTE FUNCTION driver.guard_application_transition();

CREATE OR REPLACE FUNCTION driver.guard_profile_onboarding_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.onboarding_status <> 'NOT_STARTED' AND NEW.onboarding_status IS DISTINCT FROM (
    SELECT a.status::text FROM driver.driver_application a
     WHERE a.driver_profile_id = NEW.id ORDER BY a.created_at DESC LIMIT 1
  ) THEN RAISE EXCEPTION 'DriverProfile onboarding status must project latest DriverApplication truth'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_profile_onboarding_projection_guard ON driver.driver_profile;
CREATE CONSTRAINT TRIGGER driver_profile_onboarding_projection_guard
AFTER INSERT OR UPDATE ON driver.driver_profile
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_profile_onboarding_projection();

CREATE TABLE IF NOT EXISTS compliance.requirement_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  region_code text NOT NULL,
  service_code text NOT NULL,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('IDENTITY','DRIVING_ENTITLEMENT','LICENCE','INSURANCE','DOCUMENT','TRAINING','VEHICLE','OTHER')),
  high_risk boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  policy_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_code, version, region_code, service_code),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS compliance.driver_requirement_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_application_id uuid NOT NULL REFERENCES driver.driver_application(id) ON DELETE RESTRICT,
  requirement_definition_id uuid NOT NULL REFERENCES compliance.requirement_definition(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('NOT_PROVIDED','SUBMITTED','UNDER_REVIEW','SATISFIED','REJECTED','EXPIRED')),
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_by_authority text,
  evaluated_at timestamptz,
  valid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_application_id, requirement_definition_id),
  CHECK (status <> 'SATISFIED' OR (evaluated_by_authority IS NOT NULL AND evaluated_at IS NOT NULL))
);

CREATE OR REPLACE FUNCTION driver.guard_application_authority_and_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_application_transition t
     WHERE t.driver_application_id = NEW.id AND t.version = NEW.version AND t.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'DriverApplication current state requires matching append-only transition history'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_application current_application
    JOIN driver.driver_profile p ON p.id = current_application.driver_profile_id
     WHERE current_application.id = NEW.id AND p.onboarding_status = current_application.status::text
  ) THEN RAISE EXCEPTION 'DriverApplication and DriverProfile onboarding projection must agree'; END IF;
  IF NEW.status IN ('APPROVED','DECLINED') AND NOT EXISTS (
    SELECT 1 FROM driver.driver_application_decision d
     WHERE d.driver_application_id = NEW.id AND d.decision = NEW.status
  ) THEN RAISE EXCEPTION 'DriverApplication approval/decline requires an authorised decision record'; END IF;
  IF NEW.status = 'APPROVED' AND (
    NOT EXISTS (
      SELECT 1 FROM compliance.driver_requirement_status r WHERE r.driver_application_id = NEW.id
    ) OR EXISTS (
      SELECT 1 FROM compliance.driver_requirement_status r
       WHERE r.driver_application_id = NEW.id AND (
         r.status <> 'SATISFIED' OR (r.valid_until IS NOT NULL AND r.valid_until <= NEW.decided_at)
       )
    )
  ) THEN RAISE EXCEPTION 'DriverApplication approval requires all recorded requirements satisfied and current'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_application_authority_history_guard ON driver.driver_application;
CREATE CONSTRAINT TRIGGER driver_application_authority_history_guard
AFTER INSERT OR UPDATE ON driver.driver_application
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_application_authority_and_history();

CREATE TABLE IF NOT EXISTS compliance.driver_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  driver_application_id uuid REFERENCES driver.driver_application(id) ON DELETE RESTRICT,
  document_type text NOT NULL,
  storage_object_reference text NOT NULL,
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('UPLOADED','EXTRACTION_PENDING','EXTRACTED','REVIEW_PENDING','VERIFIED','REJECTED','EXPIRED','SUPERSEDED')),
  extracted_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_authoritative boolean NOT NULL DEFAULT false CHECK (extraction_authoritative = false),
  issued_at date,
  valid_until date,
  supersedes_document_id uuid REFERENCES compliance.driver_document(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_profile_id, document_type, content_sha256),
  CHECK (supersedes_document_id IS NULL OR supersedes_document_id <> id)
);

COMMENT ON TABLE compliance.driver_document IS 'Opaque file reference, integrity hash and extraction provenance. OCR/extraction cannot verify high-risk compliance.';

CREATE TABLE IF NOT EXISTS compliance.document_verification_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_document_id uuid NOT NULL REFERENCES compliance.driver_document(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('VERIFIED','REJECTED','MORE_EVIDENCE_REQUIRED')),
  review_authority_type text NOT NULL CHECK (review_authority_type IN ('AUTHORISED_STAFF','APPROVED_PROVIDER')),
  reviewer_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  provider_review_reference text,
  reason_code text NOT NULL,
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (review_authority_type = 'AUTHORISED_STAFF' AND reviewer_person_id IS NOT NULL AND provider_review_reference IS NULL)
    OR (review_authority_type = 'APPROVED_PROVIDER' AND reviewer_person_id IS NULL AND provider_review_reference IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS document_verification_review_immutable ON compliance.document_verification_review;
CREATE TRIGGER document_verification_review_immutable
BEFORE UPDATE OR DELETE ON compliance.document_verification_review
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION compliance.guard_verified_document()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'VERIFIED' AND NOT EXISTS (
    SELECT 1 FROM compliance.document_verification_review r
    JOIN compliance.driver_document document ON document.id = r.driver_document_id
    JOIN driver.driver_profile profile ON profile.id = document.driver_profile_id
     WHERE r.driver_document_id = NEW.id AND r.decision = 'VERIFIED'
       AND (r.reviewer_person_id IS NULL OR r.reviewer_person_id <> profile.person_id)
  ) THEN RAISE EXCEPTION 'DriverDocument requires an authorised verification review'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_document_verified_guard ON compliance.driver_document;
CREATE CONSTRAINT TRIGGER driver_document_verified_guard
AFTER INSERT OR UPDATE ON compliance.driver_document
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION compliance.guard_verified_document();

CREATE TABLE IF NOT EXISTS driver.training_module (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  risk_tier text NOT NULL CHECK (risk_tier IN ('STANDARD','ELEVATED','HIGH_RISK')),
  assessment_required boolean NOT NULL,
  pass_mark_percent numeric(5,2) CHECK (pass_mark_percent BETWEEN 0 AND 100),
  unlocks_service_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  valid_from timestamptz NOT NULL,
  retired_at timestamptz,
  policy_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_code, version),
  CHECK (assessment_required = false OR pass_mark_percent IS NOT NULL),
  CHECK (risk_tier <> 'HIGH_RISK' OR assessment_required = true)
);

CREATE TABLE IF NOT EXISTS driver.training_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  training_module_id uuid NOT NULL REFERENCES driver.training_module(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status text NOT NULL CHECK (status IN ('ATTENDED','PASSED','FAILED','EXPIRED','REVOKED')),
  assessment_score_percent numeric(5,2) CHECK (assessment_score_percent BETWEEN 0 AND 100),
  assessment_evidence_reference text,
  competency_confirmed boolean NOT NULL DEFAULT false,
  assessment_authority_type text CHECK (assessment_authority_type IN ('AUTHORISED_STAFF','APPROVED_PROVIDER')),
  assessor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  provider_assessment_reference text,
  completed_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_profile_id, training_module_id, attempt_number),
  CHECK (status <> 'PASSED' OR (
    competency_confirmed = true AND assessment_authority_type IS NOT NULL AND completed_at IS NOT NULL
    AND (
      (assessment_authority_type = 'AUTHORISED_STAFF' AND assessor_person_id IS NOT NULL AND provider_assessment_reference IS NULL)
      OR (assessment_authority_type = 'APPROVED_PROVIDER' AND assessor_person_id IS NULL AND provider_assessment_reference IS NOT NULL)
    )
  )),
  CHECK (competency_confirmed = false OR status = 'PASSED'),
  CHECK (valid_until IS NULL OR (completed_at IS NOT NULL AND valid_until > completed_at))
);

CREATE OR REPLACE FUNCTION driver.guard_training_competency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  module_row driver.training_module%ROWTYPE;
  driver_person_id uuid;
BEGIN
  SELECT * INTO module_row FROM driver.training_module WHERE id = NEW.training_module_id;
  SELECT person_id INTO driver_person_id FROM driver.driver_profile WHERE id = NEW.driver_profile_id;
  IF NEW.status = 'PASSED' AND module_row.assessment_required AND (
    NEW.assessment_score_percent IS NULL OR NEW.assessment_evidence_reference IS NULL
    OR NEW.assessment_score_percent < module_row.pass_mark_percent
  ) THEN RAISE EXCEPTION 'Assessed training cannot pass without evidence meeting the versioned pass mark'; END IF;
  IF NEW.status = 'PASSED' AND NEW.assessor_person_id = driver_person_id THEN
    RAISE EXCEPTION 'A Driver cannot assess their own competency';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_training_competency_guard ON driver.training_record;
CREATE TRIGGER driver_training_competency_guard
BEFORE INSERT OR UPDATE ON driver.training_record
FOR EACH ROW EXECUTE FUNCTION driver.guard_training_competency();

CREATE TABLE IF NOT EXISTS driver.driver_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  region_code text NOT NULL,
  service_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','EXPIRED','REVOKED')),
  risk_tier text NOT NULL DEFAULT 'HIGH_RISK' CHECK (risk_tier IN ('STANDARD','ELEVATED','HIGH_RISK')),
  source_type text NOT NULL CHECK (source_type IN ('COMPLIANCE_REVIEW','TRAINING_COMPETENCY','AUTHORISED_POLICY_DECISION')),
  source_reference_id uuid NOT NULL,
  policy_version text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS driver_current_permission_idx
  ON driver.driver_permission (driver_profile_id, region_code, service_code, valid_until)
  WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION driver.guard_permission_competency_and_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND NEW.risk_tier = 'HIGH_RISK' AND (
    NEW.source_type <> 'TRAINING_COMPETENCY' OR NOT EXISTS (
      SELECT 1 FROM driver.training_record r
      JOIN driver.training_module m ON m.id = r.training_module_id
       WHERE r.id = NEW.source_reference_id AND r.driver_profile_id = NEW.driver_profile_id
         AND r.status = 'PASSED' AND r.competency_confirmed = true
         AND m.risk_tier = 'HIGH_RISK' AND m.assessment_required = true
         AND r.completed_at <= NEW.valid_from
         AND (r.valid_until IS NULL OR (NEW.valid_until IS NOT NULL AND NEW.valid_until <= r.valid_until))
    )
  ) THEN RAISE EXCEPTION 'Active high-risk permission requires current assessed competency evidence'; END IF;
  IF NEW.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM driver.driver_permission p
     WHERE p.id <> NEW.id AND p.driver_profile_id = NEW.driver_profile_id
       AND p.region_code = NEW.region_code AND p.service_code = NEW.service_code AND p.status = 'ACTIVE'
       AND tstzrange(p.valid_from, p.valid_until, '[)') && tstzrange(NEW.valid_from, NEW.valid_until, '[)')
  ) THEN RAISE EXCEPTION 'Active DriverPermission validity windows cannot overlap'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_permission_competency_overlap_guard ON driver.driver_permission;
CREATE CONSTRAINT TRIGGER driver_permission_competency_overlap_guard
AFTER INSERT OR UPDATE ON driver.driver_permission
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_permission_competency_and_overlap();

CREATE OR REPLACE VIEW driver.current_permission_projection AS
SELECT permission.*
  FROM driver.driver_permission permission
 WHERE permission.status = 'ACTIVE' AND permission.valid_from <= now()
   AND (permission.valid_until IS NULL OR permission.valid_until > now())
   AND (
     permission.risk_tier <> 'HIGH_RISK' OR (
       permission.source_type = 'TRAINING_COMPETENCY' AND EXISTS (
         SELECT 1 FROM driver.training_record record
         JOIN driver.training_module module ON module.id = record.training_module_id
          WHERE record.id = permission.source_reference_id
            AND record.driver_profile_id = permission.driver_profile_id
            AND record.status = 'PASSED' AND record.competency_confirmed = true
            AND module.risk_tier = 'HIGH_RISK' AND module.assessment_required = true
            AND record.completed_at <= now() AND (record.valid_until IS NULL OR record.valid_until > now())
       )
     )
   );

COMMENT ON VIEW driver.current_permission_projection IS 'Fail-closed current permission truth; high-risk rows disappear when assessed competency is absent, revoked or expired.';

CREATE TABLE IF NOT EXISTS driver.driver_restriction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('ALL_SERVICES','SCHOOL_ONLY','WAV_ONLY','NEW_JOURNEYS','PAYOUT_ONLY','SPECIFIC_VEHICLE')),
  vehicle_id uuid REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE','LIFTED','EXPIRED')),
  reason_code text NOT NULL,
  precautionary boolean NOT NULL DEFAULT true,
  source_domain text NOT NULL CHECK (source_domain IN ('COMPLIANCE','SAFETY','SECURITY','OPERATIONS','FINANCE')),
  source_reference_id uuid NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  lifted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'SPECIFIC_VEHICLE') = (vehicle_id IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK ((status = 'LIFTED' AND lifted_at IS NOT NULL) OR (status <> 'LIFTED' AND lifted_at IS NULL))
);

CREATE INDEX IF NOT EXISTS driver_active_restriction_idx
  ON driver.driver_restriction (driver_profile_id, scope, effective_until) WHERE status = 'ACTIVE';

ALTER TABLE dispatch.candidate_snapshot
  ADD COLUMN IF NOT EXISTS required_service_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS driver_permission_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS active_restriction_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN dispatch.candidate_snapshot.driver_permission_ids IS 'Phase 0.8 operating-permission evidence revalidated before offer acceptance; logical IDs do not grant Dispatch write authority.';

CREATE TABLE IF NOT EXISTS driver.operating_eligibility_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  selected_vehicle_id uuid REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  region_code text NOT NULL,
  status driver.operating_eligibility_status NOT NULL,
  eligible_service_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  blocker_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  CHECK (valid_until > evaluated_at)
);

DROP TRIGGER IF EXISTS operating_eligibility_snapshot_immutable ON driver.operating_eligibility_snapshot;
CREATE TRIGGER operating_eligibility_snapshot_immutable
BEFORE UPDATE OR DELETE ON driver.operating_eligibility_snapshot
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, driver_profile_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS driver.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'driver.application-started','driver.application-contact-verified','driver.application-submitted',
    'driver.application-approved','driver.application-declined','driver.permission-granted',
    'driver.permission-revoked','driver.restriction-applied','driver.restriction-lifted',
    'driver.training-competency-confirmed','driver.document-verified'
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

CREATE INDEX IF NOT EXISTS driver_outbox_unpublished_idx
  ON driver.outbox_message (occurred_at) WHERE published_at IS NULL;

CREATE OR REPLACE VIEW driver.current_application_projection AS
SELECT DISTINCT ON (a.driver_profile_id)
       a.id AS application_id, a.driver_profile_id, a.status, a.version, a.policy_version,
       a.created_at, a.updated_at
  FROM driver.driver_application a
 ORDER BY a.driver_profile_id, a.created_at DESC;

COMMENT ON TABLE driver.driver_application IS 'Resumable application truth. Only an authorised review workflow may transition REVIEW_PENDING to APPROVED.';
COMMENT ON TABLE driver.training_record IS 'Attendance is not competency. High-risk permissions require assessed current competency evidence.';
COMMENT ON TABLE driver.driver_restriction IS 'Scoped precaution/decision; it is not itself a finding of guilt and does not erase historical work.';
