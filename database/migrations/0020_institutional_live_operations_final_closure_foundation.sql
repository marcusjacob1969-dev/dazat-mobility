-- DAZAT Mobility — Engineering Phase 0.20
-- Organisation Operations Part 4 and final Organisation Engine closure.
-- Live institutional operations are a scoped lens over canonical domain services,
-- never a shadow Booking, Dispatch, Journey, Safety or Finance system.

CREATE TABLE IF NOT EXISTS organisation.institutional_operator_task_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  role_reference text NOT NULL,
  task_reference text NOT NULL,
  permitted_purposes text[] NOT NULL,
  school_safeguarding_access boolean NOT NULL DEFAULT false,
  detailed_finance_access boolean NOT NULL DEFAULT false,
  direct_database_edit_allowed boolean NOT NULL DEFAULT false CHECK (direct_database_edit_allowed = false),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(role_reference) <> '' AND btrim(task_reference) <> ''),
  CHECK (cardinality(permitted_purposes) > 0 AND valid_until > valid_from)
);

DROP TRIGGER IF EXISTS institutional_operator_task_scope_immutable ON organisation.institutional_operator_task_scope;
CREATE TRIGGER institutional_operator_task_scope_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_operator_task_scope
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_attention_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  status text NOT NULL CHECK (status IN ('OPEN','OWNED','IN_PROGRESS','WAITING','RESOLVED','CLOSED')),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  next_action text,
  attention_deadline timestamptz,
  unowned_critical_alerted boolean NOT NULL DEFAULT false,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(source_type) <> ''),
  CHECK (priority NOT IN ('P0','P1','P2','P3') OR (owner_person_id IS NOT NULL AND next_action IS NOT NULL AND attention_deadline IS NOT NULL) OR unowned_critical_alerted)
);

CREATE OR REPLACE FUNCTION organisation.guard_institutional_attention_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'owner_person_id' - 'next_action' - 'attention_deadline' - 'unowned_critical_alerted' - 'state_version' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'owner_person_id' - 'next_action' - 'attention_deadline' - 'unowned_critical_alerted' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Institutional attention source, tenant and priority are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Institutional attention update requires next version and advancing time';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institutional_attention_item_update_guard ON organisation.institutional_attention_item;
CREATE TRIGGER institutional_attention_item_update_guard BEFORE UPDATE ON organisation.institutional_attention_item
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institutional_attention_update();
DROP TRIGGER IF EXISTS institutional_attention_item_delete_guard ON organisation.institutional_attention_item;
CREATE TRIGGER institutional_attention_item_delete_guard BEFORE DELETE ON organisation.institutional_attention_item
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_live_transport_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  booking_series_id uuid REFERENCES organisation.booking_series(id) ON DELETE RESTRICT,
  booking_occurrence_id uuid REFERENCES organisation.booking_occurrence(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN (
    'CAPACITY','DRIVER_ELIGIBILITY','VEHICLE_ELIGIBILITY','PASSENGER_REQUIREMENT_MISMATCH',
    'APPROVAL_OR_FUNDING','CONTACT_FAILURE','PASSENGER_NOT_READY','SITE_ACCESS',
    'SCHEDULE_CONFLICT','CONTRACT_POLICY','SYSTEM_OR_PROVIDER_FAILURE'
  )),
  severity text NOT NULL CHECK (severity IN ('P0','P1','P2','P3','P4')),
  status text NOT NULL CHECK (status IN (
    'DETECTED','TRIAGED','OWNED','ACTION_IN_PROGRESS','WAITING_EXTERNAL','WAITING_CUSTOMER',
    'WAITING_SYSTEM','RESOLVED','VERIFIED','CLOSED','ESCALATED','MERGED','REOPENED','SUPERSEDED'
  )),
  source text NOT NULL,
  detected_at timestamptz NOT NULL,
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  next_action text,
  attention_deadline timestamptz,
  resolution_scope text CHECK (resolution_scope IS NULL OR resolution_scope IN ('ONE_OCCURRENCE','FUTURE_OCCURRENCES','FULL_SERIES')),
  resolution text,
  linked_safety_case_reference text,
  linked_rescue_case_reference text,
  linked_finance_case_reference text,
  linked_compliance_case_reference text,
  replaces_specialised_case boolean NOT NULL DEFAULT false CHECK (replaces_specialised_case = false),
  auto_closes_linked_case boolean NOT NULL DEFAULT false CHECK (auto_closes_linked_case = false),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((canonical_booking_id IS NOT NULL) OR (booking_series_id IS NOT NULL)),
  CHECK (btrim(source) <> ''),
  CHECK (severity NOT IN ('P0','P1','P2','P3') OR (owner_person_id IS NOT NULL AND next_action IS NOT NULL AND attention_deadline IS NOT NULL)),
  CHECK (status NOT IN ('RESOLVED','VERIFIED','CLOSED') OR resolution IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS organisation.institution_live_exception_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  exception_id uuid NOT NULL REFERENCES organisation.institution_live_transport_exception(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN (
    'DETECTED','TRIAGED','OWNED','ACTION_IN_PROGRESS','WAITING_EXTERNAL','WAITING_CUSTOMER',
    'WAITING_SYSTEM','RESOLVED','VERIFIED','CLOSED','ESCALATED','MERGED','REOPENED','SUPERSEDED'
  )),
  exception_version bigint NOT NULL CHECK (exception_version > 0),
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exception_id, exception_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS institution_live_exception_status_event_immutable ON organisation.institution_live_exception_status_event;
CREATE TRIGGER institution_live_exception_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.institution_live_exception_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_institution_live_exception_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'owner_person_id' - 'next_action' - 'attention_deadline' - 'resolution_scope' - 'resolution' - 'state_version' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'owner_person_id' - 'next_action' - 'attention_deadline' - 'resolution_scope' - 'resolution' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Institutional exception classification and canonical links are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Institutional exception update requires next version and advancing time';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.institution_live_exception_status_event event
     WHERE event.exception_id = NEW.id AND event.exception_version = NEW.state_version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Institutional exception update requires matching lifecycle evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_live_exception_update_guard ON organisation.institution_live_transport_exception;
CREATE CONSTRAINT TRIGGER institution_live_exception_update_guard AFTER UPDATE ON organisation.institution_live_transport_exception
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_institution_live_exception_update();
DROP TRIGGER IF EXISTS institution_live_exception_delete_guard ON organisation.institution_live_transport_exception;
CREATE TRIGGER institution_live_exception_delete_guard BEFORE DELETE ON organisation.institution_live_transport_exception
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_exception_resolution_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  exception_id uuid NOT NULL REFERENCES organisation.institution_live_transport_exception(id) ON DELETE RESTRICT,
  intended_outcome text NOT NULL,
  actual_outcome text NOT NULL,
  verified boolean NOT NULL,
  evidence_references text[] NOT NULL,
  verified_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(intended_outcome) <> '' AND btrim(actual_outcome) <> ''),
  CHECK (cardinality(evidence_references) > 0)
);

DROP TRIGGER IF EXISTS institution_exception_resolution_verification_immutable ON organisation.institution_exception_resolution_verification;
CREATE TRIGGER institution_exception_resolution_verification_immutable BEFORE UPDATE OR DELETE ON organisation.institution_exception_resolution_verification
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_readiness_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  booking_occurrence_id uuid NOT NULL REFERENCES organisation.booking_occurrence(id) ON DELETE RESTRICT,
  booking_version bigint NOT NULL CHECK (booking_version > 0),
  outcome text NOT NULL CHECK (outcome IN ('READY','WATCH','AT_RISK','BLOCKED')),
  agreement_current boolean NOT NULL,
  funding_current boolean NOT NULL,
  passenger_service_eligibility_current boolean NOT NULL,
  contact_plan_current boolean NOT NULL,
  specialist_capacity_current boolean NOT NULL,
  calendar_site_exceptions_applied boolean NOT NULL,
  driver_guaranteed boolean NOT NULL DEFAULT false CHECK (driver_guaranteed = false),
  material_change_version bigint NOT NULL CHECK (material_change_version > 0),
  assessed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_occurrence_id, booking_version, material_change_version)
);

DROP TRIGGER IF EXISTS institution_readiness_assessment_immutable ON organisation.institution_readiness_assessment;
CREATE TRIGGER institution_readiness_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.institution_readiness_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_readiness_dimension_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  assessment_id uuid NOT NULL REFERENCES organisation.institution_readiness_assessment(id) ON DELETE RESTRICT,
  dimension text NOT NULL CHECK (dimension IN ('AGREEMENT','FUNDING','PASSENGER_SERVICE_ELIGIBILITY','CONTACT','CAPACITY','CALENDAR_SITE')),
  result text NOT NULL CHECK (result IN ('PASS','WATCH','FAIL','UNKNOWN')),
  evidence_reference text NOT NULL,
  evaluated_at timestamptz NOT NULL,
  UNIQUE (assessment_id, dimension),
  CHECK (btrim(evidence_reference) <> '')
);

DROP TRIGGER IF EXISTS institution_readiness_dimension_result_immutable ON organisation.institution_readiness_dimension_result;
CREATE TRIGGER institution_readiness_dimension_result_immutable BEFORE UPDATE OR DELETE ON organisation.institution_readiness_dimension_result
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_manual_dispatch_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  normal_driver_eligibility_passed boolean NOT NULL,
  vehicle_eligibility_passed boolean NOT NULL,
  institutional_service_permission_passed boolean NOT NULL,
  accessibility_passed boolean NOT NULL,
  safeguarding_passed boolean NOT NULL,
  schedule_conflict_free boolean NOT NULL,
  partner_equivalent_controls_passed boolean,
  forced_ineligible_assignment boolean NOT NULL DEFAULT false CHECK (forced_ineligible_assignment = false),
  outcome text NOT NULL CHECK (outcome IN ('ELIGIBLE','NO_ELIGIBLE_DRIVER','DENIED')),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome <> 'ELIGIBLE' OR (normal_driver_eligibility_passed AND vehicle_eligibility_passed
    AND institutional_service_permission_passed AND accessibility_passed AND safeguarding_passed AND schedule_conflict_free))
);

DROP TRIGGER IF EXISTS institutional_manual_dispatch_assessment_immutable ON organisation.institutional_manual_dispatch_assessment;
CREATE TRIGGER institutional_manual_dispatch_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_manual_dispatch_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_booking_execution_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  booking_version bigint NOT NULL CHECK (booking_version > 0),
  agreement_version_id uuid NOT NULL REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  service_policy_version_id uuid NOT NULL REFERENCES organisation.organisation_service_policy_version(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES organisation.billing_account(id) ON DELETE RESTRICT,
  funding_reference_id uuid REFERENCES organisation.funding_reference(id) ON DELETE RESTRICT,
  approval_request_id uuid REFERENCES organisation.organisation_approval_request(id) ON DELETE RESTRICT,
  original_decision_history_reference text NOT NULL,
  mutable_portal_setting_is_authority boolean NOT NULL DEFAULT false CHECK (mutable_portal_setting_is_authority = false),
  historical_context_rewritten boolean NOT NULL DEFAULT false CHECK (historical_context_rewritten = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_booking_id, booking_version),
  CHECK (btrim(original_decision_history_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_booking_execution_context_immutable ON organisation.institutional_booking_execution_context;
CREATE TRIGGER institutional_booking_execution_context_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_booking_execution_context
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.school_handover_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  arrival_communication_plan_reference text NOT NULL,
  approved_verification_reference text NOT NULL,
  handover_outcome text NOT NULL CHECK (handover_outcome IN ('AUTHORISED_HANDOVER','APPROVED_INDEPENDENT_TRAVEL','HANDOVER_FAILED')),
  p1_safeguarding_case_reference text,
  ordinary_completion_blocked boolean NOT NULL,
  manifest_operational_minimum_only boolean NOT NULL CHECK (manifest_operational_minimum_only = true),
  route_change_version_reference text,
  diagnoses_or_historical_safeguarding_notes_in_manifest boolean NOT NULL DEFAULT false CHECK (diagnoses_or_historical_safeguarding_notes_in_manifest = false),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(arrival_communication_plan_reference) <> '' AND btrim(approved_verification_reference) <> ''),
  CHECK (handover_outcome <> 'HANDOVER_FAILED' OR (ordinary_completion_blocked AND p1_safeguarding_case_reference IS NOT NULL))
);

DROP TRIGGER IF EXISTS school_handover_execution_immutable ON organisation.school_handover_execution;
CREATE TRIGGER school_handover_execution_immutable BEFORE UPDATE OR DELETE ON organisation.school_handover_execution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.authority_funding_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  funding_authorisation_version_id uuid NOT NULL REFERENCES organisation.funding_authorisation_version(id) ON DELETE RESTRICT,
  competent_authority_decision_reference text NOT NULL,
  dazat_invented_statutory_eligibility boolean NOT NULL DEFAULT false CHECK (dazat_invented_statutory_eligibility = false),
  future_service_action text NOT NULL CHECK (future_service_action IN ('ALLOW','OPEN_FUNDING_EXCEPTION','MANUAL_REVIEW')),
  active_passenger_continuity_preserved boolean NOT NULL CHECK (active_passenger_continuity_preserved = true),
  passenger_personal_liability_created boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_created = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(competent_authority_decision_reference) <> '')
);

DROP TRIGGER IF EXISTS authority_funding_execution_immutable ON organisation.authority_funding_execution;
CREATE TRIGGER authority_funding_execution_immutable BEFORE UPDATE OR DELETE ON organisation.authority_funding_execution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.passenger_ready_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('UNKNOWN','EXPECTED_READY','READY','DELAYED','NOT_READY','CANCELLED_BY_PROVIDER')),
  state_version bigint NOT NULL CHECK (state_version > 0),
  source_contact_reference text NOT NULL,
  source_contact_authorised_for_readiness boolean NOT NULL,
  changes_payment_or_account_data boolean NOT NULL DEFAULT false CHECK (changes_payment_or_account_data = false),
  passenger_not_ready_recorded_as_no_show boolean NOT NULL DEFAULT false CHECK (passenger_not_ready_recorded_as_no_show = false),
  driver_release_recorded_as_driver_cancellation boolean NOT NULL DEFAULT false CHECK (driver_release_recorded_as_driver_cancellation = false),
  effective_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_booking_id, state_version),
  CHECK (btrim(source_contact_reference) <> '' AND source_contact_authorised_for_readiness)
);

DROP TRIGGER IF EXISTS passenger_ready_state_immutable ON organisation.passenger_ready_state;
CREATE TRIGGER passenger_ready_state_immutable BEFORE UPDATE OR DELETE ON organisation.passenger_ready_state
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.hospital_care_execution_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  ward_or_reception_contact_reference text,
  assistance_requirement_reference text NOT NULL,
  waiting_redispatch_policy_reference text NOT NULL,
  operational_data_only boolean NOT NULL CHECK (operational_data_only = true),
  diagnosis_included boolean NOT NULL DEFAULT false CHECK (diagnosis_included = false),
  emergency_medical_capability_claimed boolean NOT NULL DEFAULT false CHECK (emergency_medical_capability_claimed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(assistance_requirement_reference) <> '' AND btrim(waiting_redispatch_policy_reference) <> '')
);

DROP TRIGGER IF EXISTS hospital_care_execution_context_immutable ON organisation.hospital_care_execution_context;
CREATE TRIGGER hospital_care_execution_context_immutable BEFORE UPDATE OR DELETE ON organisation.hospital_care_execution_context
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.guest_passenger_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  guest_reference text NOT NULL,
  minimum_operational_data jsonb NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  smartphone_required boolean NOT NULL DEFAULT false CHECK (smartphone_required = false),
  indefinite_shadow_profile boolean NOT NULL DEFAULT false CHECK (indefinite_shadow_profile = false),
  personal_account_link_reference text,
  controlled_claim_link_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, guest_reference),
  CHECK (btrim(guest_reference) <> '' AND jsonb_typeof(minimum_operational_data) = 'object'),
  CHECK (valid_until > valid_from),
  CHECK (personal_account_link_reference IS NULL OR controlled_claim_link_completed)
);

DROP TRIGGER IF EXISTS guest_passenger_profile_immutable ON organisation.guest_passenger_profile;
CREATE TRIGGER guest_passenger_profile_immutable BEFORE UPDATE OR DELETE ON organisation.guest_passenger_profile
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_operational_contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('TRANSPORT_PRIMARY','TRANSPORT_OUT_OF_HOURS','SAFEGUARDING','FINANCE','CONTRACT_ACCOUNT','SITE_RECEPTION','PASSENGER_GUARDIAN_CARER','READINESS')),
  contact_reference text NOT NULL,
  verified boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','UNREACHABLE','REVOKED','EXPIRED')),
  high_risk_change_control_reference text,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(contact_reference) <> ''),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

DROP TRIGGER IF EXISTS organisation_operational_contact_immutable ON organisation.organisation_operational_contact;
CREATE TRIGGER organisation_operational_contact_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_operational_contact
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_live_change_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  requester_authority_reference text NOT NULL,
  canonical_amendment_reference text NOT NULL,
  school_guardian_change_authority_reference text,
  eligibility_revalidated boolean NOT NULL,
  payer_contract_revalidated boolean NOT NULL,
  free_text_treated_as_authority boolean NOT NULL DEFAULT false CHECK (free_text_treated_as_authority = false),
  onboard_unauthorised_redirect boolean NOT NULL DEFAULT false CHECK (onboard_unauthorised_redirect = false),
  outcome text NOT NULL CHECK (outcome IN ('ALLOWED','DENIED','REVIEW_REQUIRED')),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(requester_authority_reference) <> '' AND btrim(canonical_amendment_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_live_change_assessment_immutable ON organisation.institutional_live_change_assessment;
CREATE TRIGGER institutional_live_change_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_live_change_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_canonical_outcome_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK (outcome IN (
    'PASSENGER_CANCELLED','ORGANISATION_CANCELLED','DRIVER_CANCELLED','OPERATIONS_CANCELLED',
    'PASSENGER_NOT_READY','RIDER_NO_SHOW','SCHOOL_ABSENCE','HANDOVER_FAILED','TECHNICAL_FAILURE','NO_ELIGIBLE_DRIVER'
  )),
  source_event_reference text NOT NULL,
  finance_uses_canonical_outcome boolean NOT NULL CHECK (finance_uses_canonical_outcome = true),
  sla_uses_canonical_outcome boolean NOT NULL CHECK (sla_uses_canonical_outcome = true),
  accessibility_time_relabelled_no_show boolean NOT NULL DEFAULT false CHECK (accessibility_time_relabelled_no_show = false),
  staff_relabelled_for_billability_or_sla boolean NOT NULL DEFAULT false CHECK (staff_relabelled_for_billability_or_sla = false),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(source_event_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_canonical_outcome_assessment_immutable ON organisation.institutional_canonical_outcome_assessment;
CREATE TRIGGER institutional_canonical_outcome_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_canonical_outcome_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_continuity_execution_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  journey_id uuid NOT NULL REFERENCES journey.journey(id) ON DELETE RESTRICT,
  continuity_case_reference text NOT NULL,
  rescue_case_reference text NOT NULL,
  replacement_assignment_reference text,
  original_booking_journey_preserved boolean NOT NULL CHECK (original_booking_journey_preserved = true),
  replacement_created_new_customer_booking boolean NOT NULL DEFAULT false CHECK (replacement_created_new_customer_booking = false),
  accessibility_school_contract_revalidated boolean NOT NULL CHECK (accessibility_school_contract_revalidated = true),
  ordinary_approval_stranded_passenger boolean NOT NULL DEFAULT false CHECK (ordinary_approval_stranded_passenger = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(continuity_case_reference) <> '' AND btrim(rescue_case_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_continuity_execution_context_immutable ON organisation.institutional_continuity_execution_context;
CREATE TRIGGER institutional_continuity_execution_context_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_continuity_execution_context
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_safety_case_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  safety_or_safeguarding_case_reference text NOT NULL,
  organisation_context_reference text,
  specialised_case_authoritative boolean NOT NULL CHECK (specialised_case_authoritative = true),
  organisation_may_suppress_downgrade_or_close boolean NOT NULL DEFAULT false CHECK (organisation_may_suppress_downgrade_or_close = false),
  customer_admin_may_apply_platform_restriction boolean NOT NULL DEFAULT false CHECK (customer_admin_may_apply_platform_restriction = false),
  disclosure_authority_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(safety_or_safeguarding_case_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_safety_case_link_immutable ON organisation.institutional_safety_case_link;
CREATE TRIGGER institutional_safety_case_link_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_safety_case_link
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_compliance_evidence_package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  scope jsonb NOT NULL,
  source_versions jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  generated_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('CURRENT','EXPIRED','SUPERSEDED')),
  raw_dbs_or_safeguarding_or_security_logs_included boolean NOT NULL DEFAULT false CHECK (raw_dbs_or_safeguarding_or_security_logs_included = false),
  data_release_audit_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(purpose) <> '' AND btrim(data_release_audit_reference) <> ''),
  CHECK (jsonb_typeof(scope) = 'object' AND jsonb_typeof(source_versions) = 'object')
);

CREATE TABLE IF NOT EXISTS organisation.institutional_compliance_evidence_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES organisation.institutional_compliance_evidence_package(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL CHECK (evidence_type IN ('POLICY','INSURANCE_ATTESTATION','DRIVER_ELIGIBILITY_ATTESTATION','VEHICLE_ELIGIBILITY_ATTESTATION','TRAINING_ATTESTATION','AUDIT_SUMMARY','SERVICE_REPORT')),
  subject_reference text,
  result text NOT NULL,
  source_version_reference text NOT NULL,
  assignment_time_evaluated boolean,
  raw_personal_document_included boolean NOT NULL DEFAULT false CHECK (raw_personal_document_included = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(result) <> '' AND btrim(source_version_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_compliance_evidence_package_immutable ON organisation.institutional_compliance_evidence_package;
CREATE TRIGGER institutional_compliance_evidence_package_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_compliance_evidence_package
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS institutional_compliance_evidence_item_immutable ON organisation.institutional_compliance_evidence_item;
CREATE TRIGGER institutional_compliance_evidence_item_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_compliance_evidence_item
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_data_quality_issue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  issue_type text NOT NULL CHECK (issue_type IN ('MISSING_CONTACT','STALE_FUNDING','INVALID_SITE_ADDRESS','DUPLICATE_RELATIONSHIP','SCHEDULE_OVERLAP','UNRESOLVED_PASSENGER_REQUIREMENT')),
  severity text NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  status text NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','VERIFIED','CLOSED')),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  blocks_occurrence_or_dispatch boolean NOT NULL,
  operator_invented_missing_data boolean NOT NULL DEFAULT false CHECK (operator_invented_missing_data = false),
  correction_version_reference text,
  resolution text,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(target_type) <> ''),
  CHECK (severity <> 'CRITICAL' OR blocks_occurrence_or_dispatch),
  CHECK (status NOT IN ('RESOLVED','VERIFIED','CLOSED') OR (correction_version_reference IS NOT NULL AND resolution IS NOT NULL))
);

CREATE OR REPLACE FUNCTION organisation.guard_institutional_data_quality_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'owner_person_id' - 'correction_version_reference' - 'resolution' - 'state_version' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'owner_person_id' - 'correction_version_reference' - 'resolution' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Institutional data-quality classification and blocking truth are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Institutional data-quality update requires next version and advancing time';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institutional_data_quality_issue_update_guard ON organisation.institutional_data_quality_issue;
CREATE TRIGGER institutional_data_quality_issue_update_guard BEFORE UPDATE ON organisation.institutional_data_quality_issue
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institutional_data_quality_update();
DROP TRIGGER IF EXISTS institutional_data_quality_issue_delete_guard ON organisation.institutional_data_quality_issue;
CREATE TRIGGER institutional_data_quality_issue_delete_guard BEFORE DELETE ON organisation.institutional_data_quality_issue
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_site_operational_profile_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES organisation.organisation_site(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  pickup_entrance_and_zone jsonb NOT NULL,
  access_hours jsonb NOT NULL,
  reception_contact_reference text,
  vehicle_restrictions text[] NOT NULL DEFAULT ARRAY[]::text[],
  accessibility_access_notes text,
  restricted_safeguarding_pickup_reference text,
  geofence_is_absolute_arrival_or_no_show_proof boolean NOT NULL DEFAULT false CHECK (geofence_is_absolute_arrival_or_no_show_proof = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

DROP TRIGGER IF EXISTS organisation_site_operational_profile_version_immutable ON organisation.organisation_site_operational_profile_version;
CREATE TRIGGER organisation_site_operational_profile_version_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_site_operational_profile_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_disruption_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  disruption_type text NOT NULL CHECK (disruption_type IN ('CONSTRUCTION','CLOSURE','EVENT','SEVERE_WEATHER','SYSTEM','PARTNER','OTHER_STRUCTURED')),
  affected_site_ids uuid[] NOT NULL,
  affected_geography jsonb,
  affected_services text[] NOT NULL,
  active_window tstzrange NOT NULL,
  source_reference text NOT NULL,
  future_bookings_evaluated boolean NOT NULL,
  authorised_changes_communicated boolean NOT NULL,
  destroys_recurring_series boolean NOT NULL DEFAULT false CHECK (destroys_recurring_series = false),
  declared_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(affected_site_ids) > 0 AND cardinality(affected_services) > 0),
  CHECK (NOT isempty(active_window) AND btrim(source_reference) <> '')
);

CREATE TABLE IF NOT EXISTS organisation.institution_disruption_impact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  disruption_event_id uuid NOT NULL REFERENCES organisation.institution_disruption_event(id) ON DELETE RESTRICT,
  canonical_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  booking_occurrence_id uuid REFERENCES organisation.booking_occurrence(id) ON DELETE RESTRICT,
  impact text NOT NULL CHECK (impact IN ('NO_CHANGE','SKIP_OCCURRENCE','CANCEL_OCCURRENCE','REPLAN_PICKUP','REVIEW_REQUIRED')),
  authorised_change_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (canonical_booking_id IS NOT NULL OR booking_occurrence_id IS NOT NULL)
);

DROP TRIGGER IF EXISTS institution_disruption_event_immutable ON organisation.institution_disruption_event;
CREATE TRIGGER institution_disruption_event_immutable BEFORE UPDATE OR DELETE ON organisation.institution_disruption_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS institution_disruption_impact_immutable ON organisation.institution_disruption_impact;
CREATE TRIGGER institution_disruption_impact_immutable BEFORE UPDATE OR DELETE ON organisation.institution_disruption_impact
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.partner_overflow_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  partner_agreement_reference text NOT NULL,
  partner_driver_reference text NOT NULL,
  partner_vehicle_reference text NOT NULL,
  driver_vehicle_eligible boolean NOT NULL,
  equivalent_accessibility_safeguarding_service_controls boolean NOT NULL,
  canonical_dazat_booking_journey_retained boolean NOT NULL CHECK (canonical_dazat_booking_journey_retained = true),
  sufficient_status_events_required boolean NOT NULL CHECK (sufficient_status_events_required = true),
  partner_failure_blames_passenger boolean NOT NULL DEFAULT false CHECK (partner_failure_blames_passenger = false),
  whole_organisation_roster_shared boolean NOT NULL DEFAULT false CHECK (whole_organisation_roster_shared = false),
  outcome text NOT NULL CHECK (outcome IN ('ELIGIBLE','REJECTED','REVIEW_REQUIRED')),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(partner_agreement_reference) <> '' AND btrim(partner_driver_reference) <> '' AND btrim(partner_vehicle_reference) <> ''),
  CHECK (outcome <> 'ELIGIBLE' OR (driver_vehicle_eligible AND equivalent_accessibility_safeguarding_service_controls))
);

DROP TRIGGER IF EXISTS partner_overflow_assessment_immutable ON organisation.partner_overflow_assessment;
CREATE TRIGGER partner_overflow_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.partner_overflow_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_degraded_mode_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  degraded_dependency text NOT NULL CHECK (degraded_dependency IN ('MAPS','COMMUNICATIONS','PORTAL_API','PARTNER','PAYMENT','SHIELD','CORE_SYSTEM')),
  active_journeys_and_safety_prioritised boolean NOT NULL CHECK (active_journeys_and_safety_prioritised = true),
  canonical_contingency_interface_used boolean NOT NULL CHECK (canonical_contingency_interface_used = true),
  shadow_spreadsheet_or_personal_messaging_used boolean NOT NULL DEFAULT false CHECK (shadow_spreadsheet_or_personal_messaging_used = false),
  contingency_records_uniquely_identified boolean NOT NULL CHECK (contingency_records_uniquely_identified = true),
  recovery_deduplicates_and_reconciles boolean NOT NULL CHECK (recovery_deduplicates_and_reconciles = true),
  blind_payment_retry_allowed boolean NOT NULL DEFAULT false CHECK (blind_payment_retry_allowed = false),
  risky_shield_changes_paused boolean NOT NULL,
  decision_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(decision_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_degraded_mode_decision_immutable ON organisation.institutional_degraded_mode_decision;
CREATE TRIGGER institutional_degraded_mode_decision_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_degraded_mode_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_security_containment_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  risk_reference text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('LIMIT','STEP_UP','HOLD','REVIEW')),
  capability_scope text[] NOT NULL,
  compromised_session_or_credential_revoked boolean NOT NULL,
  active_journeys_continue_safely boolean NOT NULL CHECK (active_journeys_continue_safely = true),
  high_risk_change_held boolean NOT NULL,
  trusted_contact_safe_notification_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(risk_reference) <> '' AND cardinality(capability_scope) > 0)
);

DROP TRIGGER IF EXISTS institutional_security_containment_decision_immutable ON organisation.institutional_security_containment_decision;
CREATE TRIGGER institutional_security_containment_decision_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_security_containment_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_live_tracking_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  recipient_role text NOT NULL,
  purpose text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  unrelated_history_visible boolean NOT NULL DEFAULT false CHECK (unrelated_history_visible = false),
  general_employee_surveillance_allowed boolean NOT NULL DEFAULT false CHECK (general_employee_surveillance_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(recipient_role) <> '' AND btrim(purpose) <> '' AND valid_until > valid_from)
);

DROP TRIGGER IF EXISTS institutional_live_tracking_grant_immutable ON organisation.institutional_live_tracking_grant;
CREATE TRIGGER institutional_live_tracking_grant_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_live_tracking_grant
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_ai_assistance_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('SUMMARISE_CASE','SUGGEST_SCHEDULE_CONFLICT','DRAFT_COMMUNICATION','RETRIEVE_POLICY')),
  source_references text[] NOT NULL,
  human_actor_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  invented_approval_funding_eligibility_or_compliance boolean NOT NULL DEFAULT false CHECK (invented_approval_funding_eligibility_or_compliance = false),
  independently_terminated_contract boolean NOT NULL DEFAULT false CHECK (independently_terminated_contract = false),
  independently_closed_safeguarding_case boolean NOT NULL DEFAULT false CHECK (independently_closed_safeguarding_case = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(source_references) > 0)
);

DROP TRIGGER IF EXISTS institutional_ai_assistance_record_immutable ON organisation.institutional_ai_assistance_record;
CREATE TRIGGER institutional_ai_assistance_record_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_ai_assistance_record
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_service_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  assessment_version bigint NOT NULL CHECK (assessment_version > 0),
  status text NOT NULL CHECK (status IN ('HEALTHY','WATCH','AT_RISK','CRITICAL','UNKNOWN')),
  contract_validity text NOT NULL,
  funding_credit text NOT NULL,
  capacity_risk text NOT NULL,
  contactability text NOT NULL,
  data_quality text NOT NULL,
  open_critical_case_count integer NOT NULL CHECK (open_critical_case_count >= 0),
  api_channel_health text NOT NULL,
  unresolved_action_count integer NOT NULL CHECK (unresolved_action_count >= 0),
  evidence_references text[] NOT NULL,
  safety_severity_blended_into_customer_score boolean NOT NULL DEFAULT false CHECK (safety_severity_blended_into_customer_score = false),
  punitive_mystery_score_created boolean NOT NULL DEFAULT false CHECK (punitive_mystery_score_created = false),
  automatically_cancels_bookings boolean NOT NULL DEFAULT false CHECK (automatically_cancels_bookings = false),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, assessment_version),
  CHECK (cardinality(evidence_references) > 0)
);

DROP TRIGGER IF EXISTS organisation_service_health_immutable ON organisation.organisation_service_health;
CREATE TRIGGER organisation_service_health_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_service_health
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_shift_handover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  outgoing_operator_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  incoming_operator_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PREPARED','OFFERED','ACCEPTED','REJECTED')),
  p0_p1_ownership_accepted boolean NOT NULL DEFAULT false,
  unsupported_guarantee_promised boolean NOT NULL DEFAULT false CHECK (unsupported_guarantee_promised = false),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CHECK (status <> 'ACCEPTED' OR (p0_p1_ownership_accepted AND accepted_at IS NOT NULL)),
  CHECK (status = 'ACCEPTED' OR accepted_at IS NULL)
);

CREATE TABLE IF NOT EXISTS organisation.institutional_shift_handover_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handover_id uuid NOT NULL REFERENCES organisation.institutional_shift_handover(id) ON DELETE RESTRICT,
  item_type text NOT NULL CHECK (item_type IN ('SCHOOL_PICKUP','CAPACITY_RISK','FAILED_CONTACT','CONTINUITY_CASE','FUNDING_EXCEPTION','PARTNER_ISSUE','INCIDENT')),
  target_reference text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  next_action text NOT NULL,
  attention_at timestamptz NOT NULL,
  free_text_only boolean NOT NULL DEFAULT false CHECK (free_text_only = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(target_reference) <> '' AND btrim(next_action) <> '')
);

CREATE OR REPLACE FUNCTION organisation.guard_institutional_shift_handover_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.outgoing_operator_person_id IS DISTINCT FROM NEW.outgoing_operator_person_id
     OR OLD.incoming_operator_person_id IS DISTINCT FROM NEW.incoming_operator_person_id
     OR OLD.unsupported_guarantee_promised IS DISTINCT FROM NEW.unsupported_guarantee_promised
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institutional shift handover identity and control envelope are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Institutional shift handover update requires the next version and a later update time';
  END IF;
  IF OLD.status IN ('ACCEPTED','REJECTED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal institutional shift handover status cannot transition';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
       (OLD.status = 'PREPARED' AND NEW.status = 'OFFERED')
    OR (OLD.status = 'OFFERED' AND NEW.status IN ('ACCEPTED','REJECTED'))
  ) THEN
    RAISE EXCEPTION 'Invalid institutional shift handover transition';
  END IF;
  IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'Institutional shift handover acceptance time is immutable once recorded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institutional_shift_handover_update_guard ON organisation.institutional_shift_handover;
CREATE TRIGGER institutional_shift_handover_update_guard BEFORE UPDATE ON organisation.institutional_shift_handover
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institutional_shift_handover_update();
DROP TRIGGER IF EXISTS institutional_shift_handover_delete_guard ON organisation.institutional_shift_handover;
CREATE TRIGGER institutional_shift_handover_delete_guard BEFORE DELETE ON organisation.institutional_shift_handover
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS institutional_shift_handover_item_immutable ON organisation.institutional_shift_handover_item;
CREATE TRIGGER institutional_shift_handover_item_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_shift_handover_item
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_launch_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('NOT_ASSESSED','IN_PROGRESS','FAILED','PASSED','RISK_ACCEPTED','EXPIRED')),
  signed_agreement_present boolean NOT NULL,
  required_gate_count integer NOT NULL CHECK (required_gate_count > 0),
  passed_gate_count integer NOT NULL CHECK (passed_gate_count >= 0),
  failed_gate_count integer NOT NULL CHECK (failed_gate_count >= 0),
  sales_status_override_allowed boolean NOT NULL DEFAULT false CHECK (sales_status_override_allowed = false),
  accountable_risk_acceptance_reference text,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  assessed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (passed_gate_count + failed_gate_count <= required_gate_count),
  CHECK (status <> 'PASSED' OR (signed_agreement_present AND passed_gate_count = required_gate_count AND failed_gate_count = 0)),
  CHECK (status <> 'RISK_ACCEPTED' OR accountable_risk_acceptance_reference IS NOT NULL),
  CHECK (status IN ('NOT_ASSESSED','IN_PROGRESS') OR assessed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS organisation.institution_launch_gate_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  readiness_id uuid NOT NULL REFERENCES organisation.institution_launch_readiness(id) ON DELETE RESTRICT,
  gate text NOT NULL CHECK (gate IN ('AGREEMENT_POLICY','BILLING_FUNDING','AUTHORISED_USERS_CONTACTS','ROSTER_IMPORT','RECURRING_SCHEDULES','SPECIALIST_CAPACITY','SAFEGUARDING_WAV','COMMUNICATIONS','PORTAL_API','SUPPORT_ROUTES','CONTINGENCY')),
  result text NOT NULL CHECK (result IN ('PASS','FAIL','NOT_TESTED')),
  evidence_reference text,
  action_plan_reference text,
  tested_at timestamptz,
  UNIQUE (readiness_id, gate),
  CHECK (result <> 'PASS' OR evidence_reference IS NOT NULL),
  CHECK (result <> 'FAIL' OR action_plan_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS institution_launch_readiness_delete_guard ON organisation.institution_launch_readiness;
CREATE TRIGGER institution_launch_readiness_delete_guard BEFORE DELETE ON organisation.institution_launch_readiness
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_institution_launch_readiness_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.signed_agreement_present IS DISTINCT FROM NEW.signed_agreement_present
     OR OLD.required_gate_count IS DISTINCT FROM NEW.required_gate_count
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institution launch readiness identity and assessment envelope are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Institution launch readiness update requires the next version and a later update time';
  END IF;
  IF OLD.status IN ('PASSED','RISK_ACCEPTED','EXPIRED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal institution launch readiness status cannot transition';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
       (OLD.status = 'NOT_ASSESSED' AND NEW.status = 'IN_PROGRESS')
    OR (OLD.status = 'IN_PROGRESS' AND NEW.status IN ('FAILED','PASSED','RISK_ACCEPTED','EXPIRED'))
    OR (OLD.status = 'FAILED' AND NEW.status IN ('IN_PROGRESS','RISK_ACCEPTED','EXPIRED'))
  ) THEN
    RAISE EXCEPTION 'Invalid institution launch readiness transition';
  END IF;
  IF NEW.passed_gate_count < OLD.passed_gate_count OR NEW.failed_gate_count < OLD.failed_gate_count THEN
    RAISE EXCEPTION 'Institution launch gate counts cannot decrease in place';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_launch_readiness_update_guard ON organisation.institution_launch_readiness;
CREATE TRIGGER institution_launch_readiness_update_guard BEFORE UPDATE ON organisation.institution_launch_readiness
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institution_launch_readiness_update();
DROP TRIGGER IF EXISTS institution_launch_gate_result_immutable ON organisation.institution_launch_gate_result;
CREATE TRIGGER institution_launch_gate_result_immutable BEFORE UPDATE OR DELETE ON organisation.institution_launch_gate_result
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_pilot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  launch_readiness_id uuid NOT NULL REFERENCES organisation.institution_launch_readiness(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PLANNED','ACTIVE','GATE_REVIEW','PASSED','FAILED','PAUSED','ENDED')),
  geography_scope jsonb NOT NULL,
  passenger_cohort_scope jsonb NOT NULL,
  service_types text[] NOT NULL,
  operating_hours jsonb NOT NULL,
  volume_limit integer NOT NULL CHECK (volume_limit > 0),
  automatic_expansion_allowed boolean NOT NULL DEFAULT false CHECK (automatic_expansion_allowed = false),
  authorised_risk_acceptance_reference text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(service_types) > 0),
  CHECK (status IN ('PLANNED') OR started_at IS NOT NULL),
  CHECK (status <> 'ENDED' OR ended_at IS NOT NULL),
  CHECK (ended_at IS NULL OR (started_at IS NOT NULL AND ended_at >= started_at))
);

CREATE TABLE IF NOT EXISTS organisation.institution_pilot_gate_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES organisation.institution_pilot(id) ON DELETE RESTRICT,
  gate text NOT NULL CHECK (gate IN ('SAFETY','PICKUP_PERFORMANCE','COMMUNICATION','CAPACITY','SUPPORT','BILLING_ACCURACY')),
  result text NOT NULL CHECK (result IN ('PASS','FAIL','NOT_TESTED')),
  evidence_reference text,
  remediation_reference text,
  evaluated_at timestamptz NOT NULL,
  UNIQUE (pilot_id, gate),
  CHECK (result <> 'PASS' OR evidence_reference IS NOT NULL),
  CHECK (result <> 'FAIL' OR remediation_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS institution_pilot_delete_guard ON organisation.institution_pilot;
CREATE TRIGGER institution_pilot_delete_guard BEFORE DELETE ON organisation.institution_pilot
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_institution_pilot_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.launch_readiness_id IS DISTINCT FROM NEW.launch_readiness_id
     OR OLD.geography_scope IS DISTINCT FROM NEW.geography_scope
     OR OLD.passenger_cohort_scope IS DISTINCT FROM NEW.passenger_cohort_scope
     OR OLD.service_types IS DISTINCT FROM NEW.service_types
     OR OLD.operating_hours IS DISTINCT FROM NEW.operating_hours
     OR OLD.volume_limit IS DISTINCT FROM NEW.volume_limit
     OR OLD.automatic_expansion_allowed IS DISTINCT FROM NEW.automatic_expansion_allowed
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institution pilot identity and authorised scope are immutable';
  END IF;
  IF OLD.status IN ('PASSED','FAILED','ENDED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal institution pilot status cannot transition';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
       (OLD.status = 'PLANNED' AND NEW.status IN ('ACTIVE','PAUSED','ENDED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('GATE_REVIEW','PAUSED','ENDED'))
    OR (OLD.status = 'GATE_REVIEW' AND NEW.status IN ('ACTIVE','PAUSED','PASSED','FAILED','ENDED'))
    OR (OLD.status = 'PAUSED' AND NEW.status IN ('ACTIVE','GATE_REVIEW','ENDED'))
  ) THEN
    RAISE EXCEPTION 'Invalid institution pilot transition';
  END IF;
  IF OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Institution pilot start time is immutable once recorded';
  END IF;
  IF OLD.ended_at IS NOT NULL AND NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
    RAISE EXCEPTION 'Institution pilot end time is immutable once recorded';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_pilot_update_guard ON organisation.institution_pilot;
CREATE TRIGGER institution_pilot_update_guard BEFORE UPDATE ON organisation.institution_pilot
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institution_pilot_update();
DROP TRIGGER IF EXISTS institution_pilot_gate_result_immutable ON organisation.institution_pilot_gate_result;
CREATE TRIGGER institution_pilot_gate_result_immutable BEFORE UPDATE OR DELETE ON organisation.institution_pilot_gate_result
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institution_exit_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT','INVENTORY_IN_PROGRESS','REVIEW','APPROVED','EXECUTING','COMPLETED','CANCELLED')),
  new_booking_stop_at timestamptz NOT NULL,
  future_booking_disposition text NOT NULL CHECK (future_booking_disposition IN ('HONOUR','CANCEL','TRANSFER_FUNDING','REAPPROVE','MANUAL_REVIEW')),
  portal_api_revoke_at timestamptz NOT NULL,
  lawful_records_and_open_cases_preserved boolean NOT NULL CHECK (lawful_records_and_open_cases_preserved = true),
  governed_export_process_required boolean NOT NULL CHECK (governed_export_process_required = true),
  active_passenger_abandonment_allowed boolean NOT NULL DEFAULT false CHECK (active_passenger_abandonment_allowed = false),
  owner_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organisation.institution_exit_inventory_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_plan_id uuid NOT NULL REFERENCES organisation.institution_exit_plan(id) ON DELETE RESTRICT,
  item_type text NOT NULL CHECK (item_type IN ('ACTIVE_JOURNEY','FUTURE_BOOKING','BOOKING_SERIES','SAFETY_CASE','SUPPORT_CASE','FINANCE_CASE','API_CREDENTIAL','USER_ACCESS','EXPORT','PARTNER_DEPENDENCY')),
  target_reference text NOT NULL,
  disposition text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(target_reference) <> '' AND btrim(disposition) <> ''),
  CHECK (NOT completed OR completed_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS institution_exit_plan_delete_guard ON organisation.institution_exit_plan;
CREATE TRIGGER institution_exit_plan_delete_guard BEFORE DELETE ON organisation.institution_exit_plan
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_institution_exit_plan_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.new_booking_stop_at IS DISTINCT FROM NEW.new_booking_stop_at
     OR OLD.future_booking_disposition IS DISTINCT FROM NEW.future_booking_disposition
     OR OLD.portal_api_revoke_at IS DISTINCT FROM NEW.portal_api_revoke_at
     OR OLD.lawful_records_and_open_cases_preserved IS DISTINCT FROM NEW.lawful_records_and_open_cases_preserved
     OR OLD.governed_export_process_required IS DISTINCT FROM NEW.governed_export_process_required
     OR OLD.active_passenger_abandonment_allowed IS DISTINCT FROM NEW.active_passenger_abandonment_allowed
     OR OLD.owner_person_id IS DISTINCT FROM NEW.owner_person_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institution exit plan identity and approved controls are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Institution exit plan update requires the next version and a later update time';
  END IF;
  IF OLD.status IN ('COMPLETED','CANCELLED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Terminal institution exit plan status cannot transition';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
       (OLD.status = 'DRAFT' AND NEW.status IN ('INVENTORY_IN_PROGRESS','CANCELLED'))
    OR (OLD.status = 'INVENTORY_IN_PROGRESS' AND NEW.status IN ('REVIEW','CANCELLED'))
    OR (OLD.status = 'REVIEW' AND NEW.status IN ('INVENTORY_IN_PROGRESS','APPROVED','CANCELLED'))
    OR (OLD.status = 'APPROVED' AND NEW.status IN ('EXECUTING','CANCELLED'))
    OR (OLD.status = 'EXECUTING' AND NEW.status = 'COMPLETED')
  ) THEN
    RAISE EXCEPTION 'Invalid institution exit plan transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_exit_plan_update_guard ON organisation.institution_exit_plan;
CREATE TRIGGER institution_exit_plan_update_guard BEFORE UPDATE ON organisation.institution_exit_plan
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institution_exit_plan_update();
DROP TRIGGER IF EXISTS institution_exit_inventory_item_delete_guard ON organisation.institution_exit_inventory_item;
CREATE TRIGGER institution_exit_inventory_item_delete_guard BEFORE DELETE ON organisation.institution_exit_inventory_item
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_live_acceptance_case_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_number integer NOT NULL CHECK (scenario_number BETWEEN 72 AND 101),
  scenario_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  fixture_reference text NOT NULL,
  canonical_domains_preserved boolean NOT NULL DEFAULT true CHECK (canonical_domains_preserved = true),
  active_passenger_continuity_preserved boolean NOT NULL DEFAULT true CHECK (active_passenger_continuity_preserved = true),
  shadow_system_used boolean NOT NULL DEFAULT false CHECK (shadow_system_used = false),
  external_execution_allowed boolean NOT NULL DEFAULT false CHECK (external_execution_allowed = false),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_key, version),
  UNIQUE (scenario_number, version),
  CHECK (btrim(scenario_key) <> '' AND btrim(fixture_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_live_acceptance_case_immutable ON organisation.institutional_live_acceptance_case_version;
CREATE TRIGGER institutional_live_acceptance_case_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_live_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_live_command_deduplication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  command_name text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, command_name, idempotency_key),
  CHECK (btrim(command_name) <> '' AND btrim(idempotency_key) <> '' AND btrim(request_hash) <> '')
);

DROP TRIGGER IF EXISTS institutional_live_command_dedup_immutable ON organisation.institutional_live_command_deduplication;
CREATE TRIGGER institutional_live_command_dedup_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_live_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_live_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL CHECK (event_type IN (
    'InstitutionOccurrenceReady.v1','InstitutionOccurrenceAtRisk.v1','InstitutionOccurrenceBlocked.v1',
    'InstitutionTransportExceptionOpened.v1','InstitutionTransportExceptionEscalated.v1','InstitutionTransportExceptionResolved.v1',
    'PassengerReadyStateChanged.v1','FundingAuthorisationChanged.v1','InstitutionCriticalContactUnreachable.v1',
    'OrganisationSiteDisrupted.v1','InstitutionDisruptionDeclared.v1','InstitutionLaunchReadinessPassed.v1',
    'InstitutionLaunchReadinessFailed.v1','InstitutionPilotGatePassed.v1','InstitutionPilotGateFailed.v1',
    'InstitutionExitStarted.v1','InstitutionExitCompleted.v1'
  )),
  payload jsonb NOT NULL,
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, aggregate_type, aggregate_id, aggregate_version),
  CHECK (btrim(aggregate_type) <> '' AND jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS institutional_live_event_immutable ON organisation.institutional_live_event;
CREATE TRIGGER institutional_live_event_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_live_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_live_outbox_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES organisation.institutional_live_event(id) ON DELETE RESTRICT,
  topic text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id),
  CHECK (btrim(topic) <> '' AND btrim(event_type) <> '' AND jsonb_typeof(payload) = 'object')
);

CREATE OR REPLACE FUNCTION organisation.guard_institutional_live_outbox_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.event_id IS DISTINCT FROM NEW.event_id
     OR OLD.topic IS DISTINCT FROM NEW.topic OR OLD.event_type IS DISTINCT FROM NEW.event_type
     OR OLD.payload IS DISTINCT FROM NEW.payload OR OLD.occurred_at IS DISTINCT FROM NEW.occurred_at
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institutional live outbox envelope is immutable';
  END IF;
  IF NEW.attempt_count < OLD.attempt_count OR (OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at) THEN
    RAISE EXCEPTION 'Invalid institutional live outbox delivery transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institutional_live_outbox_update_guard ON organisation.institutional_live_outbox_message;
CREATE TRIGGER institutional_live_outbox_update_guard BEFORE UPDATE ON organisation.institutional_live_outbox_message
FOR EACH ROW EXECUTE FUNCTION organisation.guard_institutional_live_outbox_update();
DROP TRIGGER IF EXISTS institutional_live_outbox_delete_guard ON organisation.institutional_live_outbox_message;
CREATE TRIGGER institutional_live_outbox_delete_guard BEFORE DELETE ON organisation.institutional_live_outbox_message
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
