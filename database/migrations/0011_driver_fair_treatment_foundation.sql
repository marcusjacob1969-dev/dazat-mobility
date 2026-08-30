-- DAZAT Mobility — Engineering Phase 0.11
-- Driver performance and fair-treatment truth.
-- Ratings are feedback, allegations are not findings, ordinary offer declines are not misconduct,
-- precautionary restrictions are not guilt, and high-impact decisions retain an appeal route.

ALTER TABLE driver.driver_restriction
  ADD COLUMN IF NOT EXISTS restriction_basis text NOT NULL DEFAULT 'PRECAUTIONARY'
    CHECK (restriction_basis IN ('PRECAUTIONARY','ASSESSED_FINDING','LEGAL_REQUIREMENT','DRIVER_REQUEST')),
  ADD COLUMN IF NOT EXISTS narrowest_safe_scope boolean NOT NULL DEFAULT true CHECK (narrowest_safe_scope = true),
  ADD COLUMN IF NOT EXISTS guilt_finding boolean NOT NULL DEFAULT false CHECK (guilt_finding = false),
  ADD COLUMN IF NOT EXISTS applied_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_history_preserved boolean NOT NULL DEFAULT true CHECK (original_history_preserved = true);

CREATE TABLE IF NOT EXISTS driver.driver_restriction_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_restriction_id uuid NOT NULL REFERENCES driver.driver_restriction(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('CONTINUE','NARROW','LIFT')),
  reviewer_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  independent_from_original_decision boolean NOT NULL,
  evidence_references jsonb NOT NULL,
  reason_code text NOT NULL,
  creates_guilt_finding boolean NOT NULL DEFAULT false CHECK (creates_guilt_finding = false),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0)
);

DROP TRIGGER IF EXISTS driver_restriction_review_immutable ON driver.driver_restriction_review;
CREATE TRIGGER driver_restriction_review_immutable
BEFORE UPDATE OR DELETE ON driver.driver_restriction_review
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.driver_rating_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  rider_profile_id uuid REFERENCES rider.rider_profile(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  dimension_feedback jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(dimension_feedback) = 'object'),
  feedback_reference text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_conduct_finding boolean NOT NULL DEFAULT false CHECK (is_conduct_finding = false),
  automatically_restricts_driver boolean NOT NULL DEFAULT false CHECK (automatically_restricts_driver = false),
  automatically_changes_dispatch_priority boolean NOT NULL DEFAULT false CHECK (automatically_changes_dispatch_priority = false),
  UNIQUE (driver_profile_id, journey_id, rider_profile_id)
);

DROP TRIGGER IF EXISTS driver_rating_feedback_immutable ON driver.driver_rating_feedback;
CREATE TRIGGER driver_rating_feedback_immutable
BEFORE UPDATE OR DELETE ON driver.driver_rating_feedback
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.driver_complaint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  rating_feedback_id uuid REFERENCES driver.driver_rating_feedback(id) ON DELETE RESTRICT,
  safety_event_id uuid REFERENCES safety.safety_event(id) ON DELETE RESTRICT,
  allegation_category text NOT NULL CHECK (allegation_category IN (
    'SERVICE','CONDUCT','SAFETY','DISCRIMINATION','FRAUD','CANCELLATION','NO_SHOW','OTHER'
  )),
  allegation_reference text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'ALLEGATION_RECORDED','DRIVER_RESPONSE_PENDING','ASSESSMENT_PENDING',
    'FINDING_RECORDED','ACTION_PENDING','CLOSED','WITHDRAWN'
  )),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  response_opportunity_provided boolean NOT NULL DEFAULT false,
  driver_response_due_at timestamptz,
  security_classification text NOT NULL DEFAULT 'RESTRICTED'
    CHECK (security_classification IN ('RESTRICTED','HIGHLY_RESTRICTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((response_opportunity_provided AND driver_response_due_at IS NOT NULL)
      OR (NOT response_opportunity_provided AND driver_response_due_at IS NULL)),
  CHECK (allegation_category <> 'SAFETY' OR safety_event_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS driver.driver_complaint_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_complaint_id uuid NOT NULL REFERENCES driver.driver_complaint(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN (
    'ALLEGATION_RECORDED','DRIVER_RESPONSE_PENDING','ASSESSMENT_PENDING',
    'FINDING_RECORDED','ACTION_PENDING','CLOSED','WITHDRAWN'
  )),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('SYSTEM','DRIVER','AUTHORISED_REVIEWER')),
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_complaint_id, version),
  UNIQUE (command_id),
  CHECK (
    (version = 1 AND from_status IS NULL AND to_status = 'ALLEGATION_RECORDED')
    OR (version > 1 AND from_status IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS driver_complaint_transition_immutable ON driver.driver_complaint_transition;
CREATE TRIGGER driver_complaint_transition_immutable
BEFORE UPDATE OR DELETE ON driver.driver_complaint_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.driver_complaint_evidence_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_complaint_id uuid NOT NULL REFERENCES driver.driver_complaint(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL CHECK (evidence_type IN ('JOURNEY_RECORD','TELEMETRY','COMMUNICATION','DOCUMENT','WITNESS','PROVIDER','OTHER')),
  evidence_reference text NOT NULL,
  content_sha256 char(64) CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  submitted_by_type text NOT NULL CHECK (submitted_by_type IN ('RIDER','DRIVER','SYSTEM','AUTHORISED_REVIEWER','APPROVED_PROVIDER')),
  submitted_by_id uuid,
  security_classification text NOT NULL DEFAULT 'RESTRICTED'
    CHECK (security_classification IN ('RESTRICTED','HIGHLY_RESTRICTED')),
  collected_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver.driver_complaint_driver_response (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_complaint_id uuid NOT NULL REFERENCES driver.driver_complaint(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  response_type text NOT NULL CHECK (response_type IN ('STATEMENT','EVIDENCE_ONLY','DECLINED_TO_RESPOND')),
  statement_reference text,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_references) = 'array'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (response_type <> 'STATEMENT' OR statement_reference IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS driver.driver_complaint_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_complaint_id uuid NOT NULL REFERENCES driver.driver_complaint(id) ON DELETE RESTRICT,
  assessor_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  driver_response_considered boolean NOT NULL,
  vehicle_system_traffic_external_causes_considered boolean NOT NULL,
  assessment_reference text NOT NULL,
  policy_version text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver.driver_complaint_finding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_complaint_id uuid NOT NULL UNIQUE REFERENCES driver.driver_complaint(id) ON DELETE RESTRICT,
  assessment_id uuid NOT NULL REFERENCES driver.driver_complaint_assessment(id) ON DELETE RESTRICT,
  finding text NOT NULL CHECK (finding IN ('SUBSTANTIATED','NOT_SUBSTANTIATED','INCONCLUSIVE','NO_FINDING')),
  reason_code text NOT NULL,
  finding_reference text NOT NULL,
  policy_version text NOT NULL,
  decided_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  original_history_preserved boolean NOT NULL DEFAULT true CHECK (original_history_preserved = true)
);

CREATE TABLE IF NOT EXISTS driver.driver_complaint_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_complaint_id uuid NOT NULL REFERENCES driver.driver_complaint(id) ON DELETE RESTRICT,
  finding_id uuid NOT NULL REFERENCES driver.driver_complaint_finding(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN ('NO_ACTION','COACHING','TRAINING','SCOPED_RESTRICTION','OFFBOARDING_REVIEW')),
  restriction_id uuid REFERENCES driver.driver_restriction(id) ON DELETE RESTRICT,
  action_reference text NOT NULL,
  authorised_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  effective_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((action_type = 'SCOPED_RESTRICTION') = (restriction_id IS NOT NULL))
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'driver_complaint_evidence_item','driver_complaint_driver_response',
    'driver_complaint_assessment','driver_complaint_finding','driver_complaint_action'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON driver.%I', table_name || '_immutable', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON driver.%I FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation()',
      table_name || '_immutable', table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION driver.guard_complaint_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.driver_profile_id IS DISTINCT FROM OLD.driver_profile_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.journey_id IS DISTINCT FROM OLD.journey_id
     OR NEW.rating_feedback_id IS DISTINCT FROM OLD.rating_feedback_id
     OR NEW.safety_event_id IS DISTINCT FROM OLD.safety_event_id
     OR NEW.allegation_category IS DISTINCT FROM OLD.allegation_category
     OR NEW.allegation_reference IS DISTINCT FROM OLD.allegation_reference
     OR NEW.security_classification IS DISTINCT FROM OLD.security_classification
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'DriverComplaint allegation identity and provenance are immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'DriverComplaint version cannot change without a stage transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'ALLEGATION_RECORDED' THEN NEW.status IN ('DRIVER_RESPONSE_PENDING','WITHDRAWN')
    WHEN 'DRIVER_RESPONSE_PENDING' THEN NEW.status IN ('ASSESSMENT_PENDING','WITHDRAWN')
    WHEN 'ASSESSMENT_PENDING' THEN NEW.status IN ('FINDING_RECORDED','WITHDRAWN')
    WHEN 'FINDING_RECORDED' THEN NEW.status IN ('ACTION_PENDING','CLOSED')
    WHEN 'ACTION_PENDING' THEN NEW.status = 'CLOSED'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid DriverComplaint transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'DriverComplaint transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_complaint_stage_guard ON driver.driver_complaint;
CREATE TRIGGER driver_complaint_stage_guard
BEFORE UPDATE ON driver.driver_complaint
FOR EACH ROW EXECUTE FUNCTION driver.guard_complaint_transition();

CREATE OR REPLACE FUNCTION driver.guard_complaint_history_and_authority()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_complaint_transition transition
     WHERE transition.driver_complaint_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'DriverComplaint current stage requires matching append-only transition history'; END IF;
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM driver.driver_complaint_transition current_transition
    JOIN driver.driver_complaint_transition prior_transition
      ON prior_transition.driver_complaint_id = current_transition.driver_complaint_id
     AND prior_transition.version = current_transition.version - 1
     AND prior_transition.to_status = current_transition.from_status
     WHERE current_transition.driver_complaint_id = NEW.id
       AND current_transition.version = NEW.version
  ) THEN RAISE EXCEPTION 'DriverComplaint transition history must form an unbroken stage chain'; END IF;
  IF NEW.status IN ('DRIVER_RESPONSE_PENDING','ASSESSMENT_PENDING','FINDING_RECORDED','ACTION_PENDING','CLOSED')
     AND NOT NEW.response_opportunity_provided
  THEN RAISE EXCEPTION 'DriverComplaint assessment requires a recorded Driver response opportunity'; END IF;
  IF NEW.status IN ('FINDING_RECORDED','ACTION_PENDING','CLOSED') AND NOT EXISTS (
    SELECT 1 FROM driver.driver_complaint_assessment assessment
     WHERE assessment.driver_complaint_id = NEW.id
  ) THEN RAISE EXCEPTION 'DriverComplaint finding stage requires an evidence-backed assessment'; END IF;
  IF NEW.status IN ('FINDING_RECORDED','ACTION_PENDING','CLOSED') AND NOT EXISTS (
    SELECT 1 FROM driver.driver_complaint_finding finding
     WHERE finding.driver_complaint_id = NEW.id
  ) THEN RAISE EXCEPTION 'DriverComplaint finding stage requires a distinct authorised finding'; END IF;
  IF NEW.status = 'CLOSED' AND NOT EXISTS (
    SELECT 1 FROM driver.driver_complaint_action action
     WHERE action.driver_complaint_id = NEW.id
  ) THEN RAISE EXCEPTION 'DriverComplaint closure requires a distinct authorised action or NO_ACTION record'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_complaint_history_authority_guard ON driver.driver_complaint;
CREATE CONSTRAINT TRIGGER driver_complaint_history_authority_guard
AFTER INSERT OR UPDATE ON driver.driver_complaint
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_complaint_history_and_authority();

CREATE OR REPLACE FUNCTION driver.guard_complaint_finding_context()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_complaint_assessment assessment
     WHERE assessment.id = NEW.assessment_id
       AND assessment.driver_complaint_id = NEW.driver_complaint_id
  ) THEN RAISE EXCEPTION 'DriverComplaint finding must use an assessment for the same complaint'; END IF;
  IF EXISTS (
    SELECT 1 FROM driver.driver_complaint complaint
    JOIN driver.driver_profile profile ON profile.id = complaint.driver_profile_id
     WHERE complaint.id = NEW.driver_complaint_id AND profile.person_id = NEW.decided_by_person_id
  ) THEN RAISE EXCEPTION 'Driver cannot make the authorised finding on their own complaint'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_complaint_finding_context_guard ON driver.driver_complaint_finding;
CREATE CONSTRAINT TRIGGER driver_complaint_finding_context_guard
AFTER INSERT ON driver.driver_complaint_finding
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_complaint_finding_context();

CREATE TABLE IF NOT EXISTS dispatch.driver_offer_outcome_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_offer_id uuid NOT NULL UNIQUE REFERENCES dispatch.driver_offer(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN (
    'ACCEPTED','DECLINED','TIMED_OUT','TECHNICAL_FAILURE','WITHDRAWN',
    'DRIVER_BECAME_INELIGIBLE','ASSIGNED_ELSEWHERE'
  )),
  cause_class text NOT NULL CHECK (cause_class IN ('DRIVER_CHOICE','SYSTEM','PROVIDER','VEHICLE','TRAFFIC','EXTERNAL','DISPATCH','UNKNOWN')),
  reason_code text NOT NULL,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_references) = 'array'),
  ordinary_decline boolean NOT NULL DEFAULT false,
  automatically_creates_misconduct boolean NOT NULL DEFAULT false CHECK (automatically_creates_misconduct = false),
  acceptance_rate_penalty_applied boolean NOT NULL DEFAULT false CHECK (acceptance_rate_penalty_applied = false),
  dispatch_priority_penalty_applied boolean NOT NULL DEFAULT false CHECK (dispatch_priority_penalty_applied = false),
  attributed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome <> 'DECLINED' OR ordinary_decline = true)
);

DROP TRIGGER IF EXISTS driver_offer_outcome_attribution_immutable ON dispatch.driver_offer_outcome_attribution;
CREATE TRIGGER driver_offer_outcome_attribution_immutable
BEFORE UPDATE OR DELETE ON dispatch.driver_offer_outcome_attribution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

INSERT INTO dispatch.driver_offer_outcome_attribution
  (driver_offer_id, driver_profile_id, outcome, cause_class, reason_code,
   ordinary_decline, automatically_creates_misconduct,
   acceptance_rate_penalty_applied, dispatch_priority_penalty_applied,
   attributed_at)
SELECT offer.id, offer.driver_profile_id,
       CASE offer.status
         WHEN 'ACCEPTED' THEN 'ACCEPTED'
         WHEN 'DECLINED' THEN 'DECLINED'
         WHEN 'EXPIRED' THEN 'TIMED_OUT'
         WHEN 'LOST_RACE' THEN 'ASSIGNED_ELSEWHERE'
         WHEN 'WITHDRAWN' THEN CASE
           WHEN offer.response_reason = 'BOOKING_ASSIGNED' THEN 'ASSIGNED_ELSEWHERE'
           WHEN offer.response_reason = 'DRIVER_BECAME_INELIGIBLE' THEN 'DRIVER_BECAME_INELIGIBLE'
           ELSE 'WITHDRAWN'
         END
       END,
       CASE
         WHEN offer.status IN ('ACCEPTED','DECLINED','EXPIRED') THEN 'DRIVER_CHOICE'
         ELSE 'DISPATCH'
       END,
       COALESCE(offer.response_reason, 'HISTORICAL_TERMINAL_OFFER_BACKFILL'),
       offer.status = 'DECLINED', false, false, false,
       COALESCE(offer.responded_at, offer.expires_at)
  FROM dispatch.driver_offer offer
 WHERE offer.status IN ('ACCEPTED','DECLINED','EXPIRED','WITHDRAWN','LOST_RACE')
ON CONFLICT (driver_offer_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS driver.driver_reliability_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  accepted_commitment boolean NOT NULL,
  cause_class text NOT NULL CHECK (cause_class IN ('DRIVER','VEHICLE','SYSTEM','PROVIDER','TRAFFIC','EXTERNAL','UNDETERMINED')),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  assessment_reference text NOT NULL,
  reviewed_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  automatically_creates_misconduct boolean NOT NULL DEFAULT false CHECK (automatically_creates_misconduct = false),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (booking_id IS NOT NULL OR journey_id IS NOT NULL)
);

DROP TRIGGER IF EXISTS driver_reliability_review_immutable ON driver.driver_reliability_review;
CREATE TRIGGER driver_reliability_review_immutable
BEFORE UPDATE OR DELETE ON driver.driver_reliability_review
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS safety.rider_conduct_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_event_id uuid NOT NULL UNIQUE REFERENCES safety.safety_event(id) ON DELETE RESTRICT,
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  reporting_driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  subject_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  categories text[] NOT NULL CHECK (
    cardinality(categories) > 0 AND categories <@ ARRAY[
      'VIOLENCE','HARASSMENT','DISCRIMINATION','FRAUD','DANGEROUS_BEHAVIOUR','CONTACT_ABUSE','OTHER'
    ]::text[]
  ),
  report_reference text NOT NULL,
  immediate_danger boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','UNDER_REVIEW','ACTION_TAKEN','RESOLVED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  safe_termination_protected boolean NOT NULL DEFAULT true CHECK (safe_termination_protected = true),
  rating_protection_required boolean NOT NULL DEFAULT true CHECK (rating_protection_required = true),
  creates_driver_misconduct_finding boolean NOT NULL DEFAULT false CHECK (creates_driver_misconduct_finding = false),
  security_classification text NOT NULL DEFAULT 'HIGHLY_RESTRICTED' CHECK (security_classification = 'HIGHLY_RESTRICTED'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety.rider_conduct_case_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_conduct_case_id uuid NOT NULL REFERENCES safety.rider_conduct_case(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('OPEN','ACKNOWLEDGED','UNDER_REVIEW','ACTION_TAKEN','RESOLVED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('DRIVER','SYSTEM','AUTHORISED_SAFETY_REVIEWER')),
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rider_conduct_case_id, version),
  UNIQUE (command_id),
  CHECK (
    (version = 1 AND from_status IS NULL AND to_status = 'OPEN')
    OR (version > 1 AND from_status IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS rider_conduct_case_transition_immutable ON safety.rider_conduct_case_transition;
CREATE TRIGGER rider_conduct_case_transition_immutable
BEFORE UPDATE OR DELETE ON safety.rider_conduct_case_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION safety.guard_rider_conduct_case_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM safety.rider_conduct_case_transition transition
     WHERE transition.rider_conduct_case_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'RiderConductCase current state requires matching append-only transition history'; END IF;
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM safety.rider_conduct_case_transition current_transition
    JOIN safety.rider_conduct_case_transition prior_transition
      ON prior_transition.rider_conduct_case_id = current_transition.rider_conduct_case_id
     AND prior_transition.version = current_transition.version - 1
     AND prior_transition.to_status = current_transition.from_status
     WHERE current_transition.rider_conduct_case_id = NEW.id
       AND current_transition.version = NEW.version
  ) THEN RAISE EXCEPTION 'RiderConductCase transition history must form an unbroken state chain'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION safety.guard_rider_conduct_case_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.safety_event_id IS DISTINCT FROM OLD.safety_event_id
     OR NEW.journey_id IS DISTINCT FROM OLD.journey_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.reporting_driver_profile_id IS DISTINCT FROM OLD.reporting_driver_profile_id
     OR NEW.subject_person_id IS DISTINCT FROM OLD.subject_person_id
     OR NEW.categories IS DISTINCT FROM OLD.categories
     OR NEW.report_reference IS DISTINCT FROM OLD.report_reference
     OR NEW.immediate_danger IS DISTINCT FROM OLD.immediate_danger
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'RiderConductCase report identity and restricted provenance are immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'RiderConductCase version cannot change without a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'OPEN' THEN NEW.status IN ('ACKNOWLEDGED','UNDER_REVIEW')
    WHEN 'ACKNOWLEDGED' THEN NEW.status IN ('UNDER_REVIEW','ACTION_TAKEN','RESOLVED')
    WHEN 'UNDER_REVIEW' THEN NEW.status IN ('ACTION_TAKEN','RESOLVED')
    WHEN 'ACTION_TAKEN' THEN NEW.status = 'RESOLVED'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid RiderConductCase transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'RiderConductCase transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rider_conduct_case_status_guard ON safety.rider_conduct_case;
CREATE TRIGGER rider_conduct_case_status_guard
BEFORE UPDATE ON safety.rider_conduct_case
FOR EACH ROW EXECUTE FUNCTION safety.guard_rider_conduct_case_transition();

DROP TRIGGER IF EXISTS rider_conduct_case_history_guard ON safety.rider_conduct_case;
CREATE CONSTRAINT TRIGGER rider_conduct_case_history_guard
AFTER INSERT OR UPDATE ON safety.rider_conduct_case
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION safety.guard_rider_conduct_case_history();

CREATE TABLE IF NOT EXISTS journey.safety_termination (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL UNIQUE REFERENCES journey.journey(id) ON DELETE RESTRICT,
  rider_conduct_case_id uuid NOT NULL REFERENCES safety.rider_conduct_case(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  prior_journey_status text NOT NULL,
  reason_code text NOT NULL,
  terminated_at timestamptz NOT NULL DEFAULT now(),
  rating_protected boolean NOT NULL DEFAULT true CHECK (rating_protected = true),
  driver_fault_finding_created boolean NOT NULL DEFAULT false CHECK (driver_fault_finding_created = false),
  passenger_continuity_opened boolean NOT NULL DEFAULT true CHECK (passenger_continuity_opened = true)
);

DROP TRIGGER IF EXISTS journey_safety_termination_immutable ON journey.safety_termination;
CREATE TRIGGER journey_safety_termination_immutable
BEFORE UPDATE OR DELETE ON journey.safety_termination
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS finance.driver_incentive_programme_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  region_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  qualification_rules jsonb NOT NULL CHECK (jsonb_typeof(qualification_rules) = 'object'),
  visible_terms jsonb NOT NULL CHECK (jsonb_typeof(visible_terms) = 'array' AND jsonb_array_length(visible_terms) > 0),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  finance_approved_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array'),
  published_at timestamptz,
  base_earning_separate boolean NOT NULL DEFAULT true CHECK (base_earning_separate = true),
  acceptance_coercion_allowed boolean NOT NULL DEFAULT false CHECK (acceptance_coercion_allowed = false),
  fatigue_pressure_allowed boolean NOT NULL DEFAULT false CHECK (fatigue_pressure_allowed = false),
  secret_dispatch_priority_boost_allowed boolean NOT NULL DEFAULT false CHECK (secret_dispatch_priority_boost_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_key, version, region_code),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (status <> 'PUBLISHED' OR (
    finance_approved_by_person_id IS NOT NULL AND published_at IS NOT NULL
    AND jsonb_array_length(evidence_references) > 0
  ))
);

DROP TRIGGER IF EXISTS driver_incentive_programme_version_immutable ON finance.driver_incentive_programme_version;
CREATE TRIGGER driver_incentive_programme_version_immutable
BEFORE UPDATE OR DELETE ON finance.driver_incentive_programme_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS finance.driver_incentive_qualification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_version_id uuid NOT NULL REFERENCES finance.driver_incentive_programme_version(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('QUALIFIED','NOT_QUALIFIED','PENDING_EVIDENCE')),
  explanation text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  evaluated_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency char(3) CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programme_version_id, driver_profile_id),
  CHECK ((outcome = 'QUALIFIED' AND amount_minor IS NOT NULL AND currency IS NOT NULL)
      OR (outcome <> 'QUALIFIED' AND amount_minor IS NULL AND currency IS NULL))
);

DROP TRIGGER IF EXISTS driver_incentive_qualification_immutable ON finance.driver_incentive_qualification;
CREATE TRIGGER driver_incentive_qualification_immutable
BEFORE UPDATE OR DELETE ON finance.driver_incentive_qualification
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE VIEW finance.current_driver_incentive_programme AS
SELECT programme.*
  FROM finance.driver_incentive_programme_version programme
 WHERE programme.status = 'PUBLISHED'
   AND programme.published_at <= now()
   AND programme.effective_from <= now()
   AND (programme.effective_until IS NULL OR programme.effective_until > now())
   AND programme.finance_approved_by_person_id IS NOT NULL
   AND jsonb_array_length(programme.evidence_references) > 0;

CREATE TABLE IF NOT EXISTS driver.driver_offboarding_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('REVIEW_PENDING','DECIDED','APPEAL_WINDOW','CLOSED','CANCELLED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  source_reference text NOT NULL,
  earnings_preserved boolean NOT NULL DEFAULT true CHECK (earnings_preserved = true),
  disputes_preserved boolean NOT NULL DEFAULT true CHECK (disputes_preserved = true),
  vehicle_return_obligations_preserved boolean NOT NULL DEFAULT true CHECK (vehicle_return_obligations_preserved = true),
  safety_history_preserved boolean NOT NULL DEFAULT true CHECK (safety_history_preserved = true),
  financial_history_preserved boolean NOT NULL DEFAULT true CHECK (financial_history_preserved = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver.driver_offboarding_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_offboarding_case_id uuid NOT NULL REFERENCES driver.driver_offboarding_case(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('REVIEW_PENDING','DECIDED','APPEAL_WINDOW','CLOSED','CANCELLED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('SYSTEM','AUTHORISED_REVIEWER')),
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_offboarding_case_id, version),
  UNIQUE (command_id),
  CHECK (
    (version = 1 AND from_status IS NULL AND to_status = 'REVIEW_PENDING')
    OR (version > 1 AND from_status IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS driver.driver_offboarding_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_offboarding_case_id uuid NOT NULL UNIQUE REFERENCES driver.driver_offboarding_case(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('CONTINUE','SCOPED_RESTRICTION','OFFBOARD')),
  authorised_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  decision_reference text NOT NULL,
  appeal_deadline timestamptz NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  original_history_preserved boolean NOT NULL DEFAULT true CHECK (original_history_preserved = true),
  CHECK (appeal_deadline > decided_at)
);

DROP TRIGGER IF EXISTS driver_offboarding_transition_immutable ON driver.driver_offboarding_transition;
CREATE TRIGGER driver_offboarding_transition_immutable
BEFORE UPDATE OR DELETE ON driver.driver_offboarding_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS driver_offboarding_decision_immutable ON driver.driver_offboarding_decision;
CREATE TRIGGER driver_offboarding_decision_immutable
BEFORE UPDATE OR DELETE ON driver.driver_offboarding_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION driver.guard_offboarding_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.driver_profile_id IS DISTINCT FROM OLD.driver_profile_id
     OR NEW.source_reference IS DISTINCT FROM OLD.source_reference
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'DriverOffboardingCase source and Driver identity are immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'DriverOffboardingCase version cannot change without a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'REVIEW_PENDING' THEN NEW.status IN ('DECIDED','CANCELLED')
    WHEN 'DECIDED' THEN NEW.status IN ('APPEAL_WINDOW','CLOSED')
    WHEN 'APPEAL_WINDOW' THEN NEW.status = 'CLOSED'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid DriverOffboardingCase transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'DriverOffboardingCase transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_offboarding_status_guard ON driver.driver_offboarding_case;
CREATE TRIGGER driver_offboarding_status_guard
BEFORE UPDATE ON driver.driver_offboarding_case
FOR EACH ROW EXECUTE FUNCTION driver.guard_offboarding_transition();

CREATE OR REPLACE FUNCTION driver.guard_offboarding_history_and_decision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_offboarding_transition transition
     WHERE transition.driver_offboarding_case_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'DriverOffboardingCase current state requires matching append-only transition history'; END IF;
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM driver.driver_offboarding_transition current_transition
    JOIN driver.driver_offboarding_transition prior_transition
      ON prior_transition.driver_offboarding_case_id = current_transition.driver_offboarding_case_id
     AND prior_transition.version = current_transition.version - 1
     AND prior_transition.to_status = current_transition.from_status
     WHERE current_transition.driver_offboarding_case_id = NEW.id
       AND current_transition.version = NEW.version
  ) THEN RAISE EXCEPTION 'DriverOffboardingCase transition history must form an unbroken state chain'; END IF;
  IF NEW.status IN ('DECIDED','APPEAL_WINDOW','CLOSED') AND NOT EXISTS (
    SELECT 1 FROM driver.driver_offboarding_decision decision
     WHERE decision.driver_offboarding_case_id = NEW.id
  ) THEN RAISE EXCEPTION 'DriverOffboardingCase decided state requires an authorised immutable decision'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_offboarding_history_guard ON driver.driver_offboarding_case;
CREATE CONSTRAINT TRIGGER driver_offboarding_history_guard
AFTER INSERT OR UPDATE ON driver.driver_offboarding_case
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_offboarding_history_and_decision();

CREATE OR REPLACE FUNCTION driver.guard_offboarding_decision_authority()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM driver.driver_offboarding_case offboarding
    JOIN driver.driver_profile profile ON profile.id = offboarding.driver_profile_id
     WHERE offboarding.id = NEW.driver_offboarding_case_id
       AND profile.person_id = NEW.authorised_by_person_id
  ) THEN RAISE EXCEPTION 'Driver cannot authorise their own offboarding decision'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_offboarding_decision_authority_guard ON driver.driver_offboarding_decision;
CREATE CONSTRAINT TRIGGER driver_offboarding_decision_authority_guard
AFTER INSERT ON driver.driver_offboarding_decision
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_offboarding_decision_authority();

CREATE TABLE IF NOT EXISTS driver.driver_decision_appeal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  subject_type text NOT NULL CHECK (subject_type IN (
    'COMPLAINT_FINDING','DRIVER_RESTRICTION','OFFBOARDING_DECISION','INCENTIVE_QUALIFICATION'
  )),
  subject_id uuid NOT NULL,
  original_decision_maker_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('SUBMITTED','UNDER_REVIEW','UPHELD','VARIED','OVERTURNED','CLOSED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  reason_category text NOT NULL CHECK (reason_category IN ('FACTUAL_ERROR','MISSING_EVIDENCE','PROCEDURAL_FAIRNESS','DISPROPORTIONATE_ACTION','OTHER')),
  statement_reference text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  high_impact_independent_review_required boolean NOT NULL DEFAULT true CHECK (high_impact_independent_review_required = true),
  original_decision_history_preserved boolean NOT NULL DEFAULT true CHECK (original_decision_history_preserved = true),
  UNIQUE (driver_profile_id, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS driver.driver_decision_appeal_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_decision_appeal_id uuid NOT NULL REFERENCES driver.driver_decision_appeal(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('SUBMITTED','UNDER_REVIEW','UPHELD','VARIED','OVERTURNED','CLOSED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('DRIVER','SYSTEM','INDEPENDENT_REVIEWER')),
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_decision_appeal_id, version),
  UNIQUE (command_id),
  CHECK (
    (version = 1 AND from_status IS NULL AND to_status = 'SUBMITTED')
    OR (version > 1 AND from_status IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS driver.driver_decision_appeal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_decision_appeal_id uuid NOT NULL REFERENCES driver.driver_decision_appeal(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL,
  submitted_by_type text NOT NULL CHECK (submitted_by_type IN ('DRIVER','SYSTEM','INDEPENDENT_REVIEWER')),
  submitted_by_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver.driver_decision_appeal_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_decision_appeal_id uuid NOT NULL UNIQUE REFERENCES driver.driver_decision_appeal(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN ('UPHELD','VARIED','OVERTURNED')),
  reviewer_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  independent_from_original_decision boolean NOT NULL CHECK (independent_from_original_decision = true),
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  resolution_reference text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  original_decision_history_preserved boolean NOT NULL DEFAULT true CHECK (original_decision_history_preserved = true)
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'driver_decision_appeal_transition','driver_decision_appeal_evidence',
    'driver_decision_appeal_resolution'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON driver.%I', table_name || '_immutable', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON driver.%I FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation()',
      table_name || '_immutable', table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION driver.guard_appeal_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.driver_profile_id IS DISTINCT FROM OLD.driver_profile_id
     OR NEW.subject_type IS DISTINCT FROM OLD.subject_type
     OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
     OR NEW.original_decision_maker_person_id IS DISTINCT FROM OLD.original_decision_maker_person_id
     OR NEW.reason_category IS DISTINCT FROM OLD.reason_category
     OR NEW.statement_reference IS DISTINCT FROM OLD.statement_reference
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
  THEN RAISE EXCEPTION 'DriverDecisionAppeal submission and subject are immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'DriverDecisionAppeal version cannot change without a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'SUBMITTED' THEN NEW.status = 'UNDER_REVIEW'
    WHEN 'UNDER_REVIEW' THEN NEW.status IN ('UPHELD','VARIED','OVERTURNED')
    WHEN 'UPHELD' THEN NEW.status = 'CLOSED'
    WHEN 'VARIED' THEN NEW.status = 'CLOSED'
    WHEN 'OVERTURNED' THEN NEW.status = 'CLOSED'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid DriverDecisionAppeal transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'DriverDecisionAppeal transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_decision_appeal_status_guard ON driver.driver_decision_appeal;
CREATE TRIGGER driver_decision_appeal_status_guard
BEFORE UPDATE ON driver.driver_decision_appeal
FOR EACH ROW EXECUTE FUNCTION driver.guard_appeal_transition();

CREATE OR REPLACE FUNCTION driver.guard_appeal_history_and_resolution()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM driver.driver_decision_appeal_transition transition
     WHERE transition.driver_decision_appeal_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'DriverDecisionAppeal current state requires matching append-only transition history'; END IF;
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM driver.driver_decision_appeal_transition current_transition
    JOIN driver.driver_decision_appeal_transition prior_transition
      ON prior_transition.driver_decision_appeal_id = current_transition.driver_decision_appeal_id
     AND prior_transition.version = current_transition.version - 1
     AND prior_transition.to_status = current_transition.from_status
     WHERE current_transition.driver_decision_appeal_id = NEW.id
       AND current_transition.version = NEW.version
  ) THEN RAISE EXCEPTION 'DriverDecisionAppeal transition history must form an unbroken state chain'; END IF;
  IF NEW.status IN ('UPHELD','VARIED','OVERTURNED','CLOSED') AND NOT EXISTS (
    SELECT 1 FROM driver.driver_decision_appeal_resolution resolution
     WHERE resolution.driver_decision_appeal_id = NEW.id
       AND (NEW.status = 'CLOSED' OR resolution.outcome = NEW.status)
  ) THEN RAISE EXCEPTION 'High-impact appeal outcome requires independent reviewed resolution'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_decision_appeal_history_guard ON driver.driver_decision_appeal;
CREATE CONSTRAINT TRIGGER driver_decision_appeal_history_guard
AFTER INSERT OR UPDATE ON driver.driver_decision_appeal
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_appeal_history_and_resolution();

CREATE OR REPLACE FUNCTION driver.guard_appeal_resolution_independence()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM driver.driver_decision_appeal appeal
    JOIN driver.driver_profile profile ON profile.id = appeal.driver_profile_id
     WHERE appeal.id = NEW.driver_decision_appeal_id AND profile.person_id = NEW.reviewer_person_id
  ) THEN RAISE EXCEPTION 'Driver cannot independently review their own appeal'; END IF;
  IF EXISTS (
    SELECT 1 FROM driver.driver_decision_appeal appeal
     WHERE appeal.id = NEW.driver_decision_appeal_id
       AND appeal.original_decision_maker_person_id = NEW.reviewer_person_id
  ) THEN RAISE EXCEPTION 'Original decision maker cannot perform the independent appeal review'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS driver_decision_appeal_resolution_independence_guard ON driver.driver_decision_appeal_resolution;
CREATE CONSTRAINT TRIGGER driver_decision_appeal_resolution_independence_guard
AFTER INSERT ON driver.driver_decision_appeal_resolution
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION driver.guard_appeal_resolution_independence();

ALTER TABLE driver.outbox_message DROP CONSTRAINT IF EXISTS driver_outbox_message_event_type_check;
ALTER TABLE driver.outbox_message ADD CONSTRAINT driver_outbox_message_event_type_check CHECK (event_type IN (
  'driver.application-started','driver.application-contact-verified','driver.application-submitted',
  'driver.application-approved','driver.application-declined','driver.permission-granted',
  'driver.permission-revoked','driver.restriction-applied','driver.restriction-lifted',
  'driver.training-competency-confirmed','driver.document-verified',
  'driver.appeal-submitted','driver.rider-conduct-reported','driver.unsafe-journey-terminated'
));

CREATE OR REPLACE VIEW driver.current_driver_fair_treatment_projection AS
SELECT profile.id AS driver_profile_id,
       COALESCE(rating.rating_count, 0) AS rating_count,
       rating.average_rating,
       COALESCE(complaint.open_complaint_count, 0) AS open_complaint_count,
       COALESCE(complaint.substantiated_finding_count, 0) AS substantiated_finding_count,
       COALESCE(restriction.active_restriction_count, 0) AS active_restriction_count,
       COALESCE(appeal.open_appeal_count, 0) AS open_appeal_count,
       COALESCE(conduct.open_rider_conduct_case_count, 0) AS open_rider_conduct_case_count,
       false AS opaque_driver_score_used,
       false AS rating_is_finding,
       false AS ordinary_decline_penalty_applied
  FROM driver.driver_profile profile
  LEFT JOIN LATERAL (
    SELECT count(*) AS rating_count, round(avg(feedback.rating)::numeric, 2) AS average_rating
      FROM driver.driver_rating_feedback feedback
     WHERE feedback.driver_profile_id = profile.id
       AND NOT EXISTS (
         SELECT 1 FROM journey.safety_termination termination
          WHERE termination.journey_id = feedback.journey_id AND termination.rating_protected = true
       )
  ) rating ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE complaint.status NOT IN ('CLOSED','WITHDRAWN')) AS open_complaint_count,
           count(*) FILTER (WHERE finding.finding = 'SUBSTANTIATED') AS substantiated_finding_count
      FROM driver.driver_complaint complaint
      LEFT JOIN driver.driver_complaint_finding finding ON finding.driver_complaint_id = complaint.id
     WHERE complaint.driver_profile_id = profile.id
  ) complaint ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS active_restriction_count FROM driver.driver_restriction restriction
     WHERE restriction.driver_profile_id = profile.id AND restriction.status = 'ACTIVE'
       AND restriction.effective_from <= now()
       AND (restriction.effective_until IS NULL OR restriction.effective_until > now())
  ) restriction ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS open_appeal_count FROM driver.driver_decision_appeal appeal
     WHERE appeal.driver_profile_id = profile.id AND appeal.status NOT IN ('CLOSED')
  ) appeal ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS open_rider_conduct_case_count FROM safety.rider_conduct_case conduct_case
     WHERE conduct_case.reporting_driver_profile_id = profile.id AND conduct_case.status <> 'RESOLVED'
  ) conduct ON true;

COMMENT ON TABLE driver.driver_rating_feedback IS 'Rider rating is feedback, never an authorised conduct finding or automatic Dispatch-priority input.';
COMMENT ON TABLE driver.driver_complaint IS 'Complaint stages preserve allegation, Driver response, assessment, finding and action as distinct truths.';
COMMENT ON TABLE dispatch.driver_offer_outcome_attribution IS 'Exact offer outcome attribution. Ordinary declines and timeouts do not create misconduct or secret priority penalties.';
COMMENT ON TABLE safety.rider_conduct_case IS 'Restricted Safety-owned protection for Drivers reporting violence, harassment, discrimination, fraud or dangerous behaviour.';
COMMENT ON TABLE journey.safety_termination IS 'Canonical safe termination: rating is protected, no Driver fault finding is invented and passenger continuity is opened.';
COMMENT ON TABLE driver.driver_decision_appeal IS 'Governed Driver appeal. Original decision history remains immutable; high-impact outcomes require independent review.';
COMMENT ON TABLE finance.driver_incentive_programme_version IS 'Versioned, Finance-approved and auditable incentive truth, separate from base earnings and Dispatch priority.';
COMMENT ON TABLE driver.driver_offboarding_case IS 'Offboarding preserves earnings, disputes, vehicle-return obligations and historical Safety/Finance records.';
COMMENT ON VIEW driver.current_driver_fair_treatment_projection IS 'Separate fair-treatment dimensions; intentionally contains no opaque Driver Score and excludes rating feedback from rating aggregates when SafetyTermination protects the Driver.';
