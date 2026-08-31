-- DAZAT Mobility — Engineering Phase 0.18
-- Organisation Operations Part 2: institutional passengers, funding authority,
-- recurring canonical Bookings, scheduling, readiness, bulk operations and exceptions.
-- No institutional command, Journey/Payment write or external integration is enabled.

CREATE TABLE IF NOT EXISTS organisation.managed_passenger_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  passenger_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  managed_passenger_reference text,
  local_reference text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','TEMPORARILY_INACTIVE','EXPIRED','REMOVED')),
  booking_authority_scope jsonb NOT NULL,
  service_requirements_reference text NOT NULL,
  communication_plan_reference text NOT NULL,
  funding_or_cost_centre_reference text,
  local_reference_exposed_as_global_identity boolean NOT NULL DEFAULT false CHECK (local_reference_exposed_as_global_identity = false),
  organisation_owns_passenger_identity boolean NOT NULL DEFAULT false CHECK (organisation_owns_passenger_identity = false),
  diagnosis_stored_by_default boolean NOT NULL DEFAULT false CHECK (diagnosis_stored_by_default = false),
  other_organisation_relationship_disclosed boolean NOT NULL DEFAULT false CHECK (other_organisation_relationship_disclosed = false),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, local_reference),
  CHECK ((passenger_person_id IS NOT NULL) <> (managed_passenger_reference IS NOT NULL)),
  CHECK (btrim(local_reference) <> '' AND btrim(display_name) <> ''),
  CHECK (btrim(service_requirements_reference) <> '' AND btrim(communication_plan_reference) <> ''),
  CHECK (jsonb_typeof(booking_authority_scope) = 'object'),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS organisation.managed_passenger_profile_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  managed_passenger_profile_id uuid NOT NULL REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('ACTIVE','TEMPORARILY_INACTIVE','EXPIRED','REMOVED')),
  profile_version bigint NOT NULL CHECK (profile_version > 0),
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  effective_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (managed_passenger_profile_id, profile_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS managed_passenger_profile_status_event_immutable ON organisation.managed_passenger_profile_status_event;
CREATE TRIGGER managed_passenger_profile_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.managed_passenger_profile_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_managed_passenger_profile_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'valid_until' - 'state_version' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'valid_until' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Managed passenger identity, local reference and minimum transport profile are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Managed passenger profile update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'ACTIVE' AND NEW.status IN ('TEMPORARILY_INACTIVE','EXPIRED','REMOVED'))
    OR (OLD.status = 'TEMPORARILY_INACTIVE' AND NEW.status IN ('ACTIVE','EXPIRED','REMOVED'))
  ) THEN RAISE EXCEPTION 'Invalid managed passenger profile transition'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.managed_passenger_profile_status_event event
     WHERE event.managed_passenger_profile_id = NEW.id AND event.profile_version = NEW.state_version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Managed passenger profile update requires matching status evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS managed_passenger_profile_update_guard ON organisation.managed_passenger_profile;
CREATE CONSTRAINT TRIGGER managed_passenger_profile_update_guard AFTER UPDATE ON organisation.managed_passenger_profile
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_managed_passenger_profile_update();
DROP TRIGGER IF EXISTS managed_passenger_profile_delete_guard ON organisation.managed_passenger_profile;
CREATE TRIGGER managed_passenger_profile_delete_guard BEFORE DELETE ON organisation.managed_passenger_profile
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_passenger_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  managed_passenger_profile_id uuid NOT NULL REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PENDING','ACTIVE','TEMPORARILY_INACTIVE','EXPIRED','REMOVED')),
  purpose text NOT NULL,
  authority_basis_reference text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  future_booking_disposition text CHECK (future_booking_disposition IS NULL OR future_booking_disposition IN (
    'REVIEW','CANCEL','REASSIGN','HONOUR_UNDER_EXISTING_AUTHORITY'
  )),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, managed_passenger_profile_id),
  CHECK (btrim(purpose) <> '' AND btrim(authority_basis_reference) <> ''),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (status NOT IN ('EXPIRED','REMOVED') OR future_booking_disposition IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS organisation.passenger_membership_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES organisation.organisation_passenger_membership(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('PENDING','ACTIVE','TEMPORARILY_INACTIVE','EXPIRED','REMOVED')),
  membership_version bigint NOT NULL CHECK (membership_version > 0),
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  effective_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, membership_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS passenger_membership_status_event_immutable ON organisation.passenger_membership_status_event;
CREATE TRIGGER passenger_membership_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.passenger_membership_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_passenger_membership_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.managed_passenger_profile_id IS DISTINCT FROM NEW.managed_passenger_profile_id
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.authority_basis_reference IS DISTINCT FROM NEW.authority_basis_reference
     OR OLD.valid_from IS DISTINCT FROM NEW.valid_from
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institutional passenger membership identity and authority are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Passenger membership update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'PENDING' AND NEW.status IN ('ACTIVE','EXPIRED','REMOVED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('TEMPORARILY_INACTIVE','EXPIRED','REMOVED'))
    OR (OLD.status = 'TEMPORARILY_INACTIVE' AND NEW.status IN ('ACTIVE','EXPIRED','REMOVED'))
  ) THEN RAISE EXCEPTION 'Invalid institutional passenger membership transition'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.passenger_membership_status_event event
     WHERE event.membership_id = NEW.id AND event.membership_version = NEW.state_version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Passenger membership update requires matching status evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS passenger_membership_update_guard ON organisation.organisation_passenger_membership;
CREATE CONSTRAINT TRIGGER passenger_membership_update_guard AFTER UPDATE ON organisation.organisation_passenger_membership
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_passenger_membership_update();
DROP TRIGGER IF EXISTS passenger_membership_delete_guard ON organisation.organisation_passenger_membership;
CREATE TRIGGER passenger_membership_delete_guard BEFORE DELETE ON organisation.organisation_passenger_membership
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.passenger_authorised_contact_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  managed_passenger_profile_id uuid NOT NULL REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  contact_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  contact_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  contact_point_reference text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('GUARDIAN','CARER','RECEPTION','SCHOOL_OFFICE','OTHER_AUTHORISED')),
  communication_purposes text[] NOT NULL,
  may_assist_ridecheck boolean NOT NULL DEFAULT false,
  financial_access boolean NOT NULL DEFAULT false CHECK (financial_access = false),
  account_recovery_access boolean NOT NULL DEFAULT false CHECK (account_recovery_access = false),
  unrelated_history_access boolean NOT NULL DEFAULT false CHECK (unrelated_history_access = false),
  authority_evidence_reference text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, managed_passenger_profile_id, contact_key, version),
  CHECK (btrim(contact_key) <> '' AND btrim(contact_point_reference) <> ''),
  CHECK (btrim(authority_evidence_reference) <> '' AND cardinality(communication_purposes) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_passenger_authorised_contact
  ON organisation.passenger_authorised_contact_version (organisation_id, managed_passenger_profile_id, contact_key)
  WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS passenger_authorised_contact_update_guard ON organisation.passenger_authorised_contact_version;
CREATE TRIGGER passenger_authorised_contact_update_guard BEFORE UPDATE ON organisation.passenger_authorised_contact_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS passenger_authorised_contact_delete_guard ON organisation.passenger_authorised_contact_version;
CREATE TRIGGER passenger_authorised_contact_delete_guard BEFORE DELETE ON organisation.passenger_authorised_contact_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.service_eligibility_profile_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  managed_passenger_profile_id uuid NOT NULL REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  profile_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  service_types text[] NOT NULL,
  transport_requirements jsonb NOT NULL,
  region_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  time_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosis_data_included boolean NOT NULL DEFAULT false CHECK (diagnosis_data_included = false),
  accessibility_downgrade_allowed boolean NOT NULL DEFAULT false CHECK (accessibility_downgrade_allowed = false),
  reassignment_recheck_required boolean NOT NULL DEFAULT true CHECK (reassignment_recheck_required = true),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, profile_key, version),
  CHECK (btrim(profile_key) <> '' AND cardinality(service_types) > 0),
  CHECK (service_types <@ ARRAY['STANDARD','WAV','ASSISTED','SCHOOL_TRANSPORT','AIRPORT','BUSINESS','EXECUTIVE','OTHER_CONFIGURED_SERVICE']::text[]),
  CHECK (jsonb_typeof(transport_requirements) = 'object'),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_service_eligibility_profile
  ON organisation.service_eligibility_profile_version (organisation_id, profile_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS service_eligibility_profile_update_guard ON organisation.service_eligibility_profile_version;
CREATE TRIGGER service_eligibility_profile_update_guard BEFORE UPDATE ON organisation.service_eligibility_profile_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS service_eligibility_profile_delete_guard ON organisation.service_eligibility_profile_version;
CREATE TRIGGER service_eligibility_profile_delete_guard BEFORE DELETE ON organisation.service_eligibility_profile_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.funding_authorisation_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  managed_passenger_profile_id uuid REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  passenger_group_reference text,
  authorisation_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  funding_source_type text NOT NULL CHECK (funding_source_type IN ('ORGANISATION','LOCAL_AUTHORITY','HOSPITAL','SCHOOL','BUSINESS_COST_CENTRE','OTHER_APPROVED')),
  permitted_service_types text[] NOT NULL,
  permitted_journey_purposes text[] NOT NULL,
  origin_destination_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  maximum_authorised_amount_minor bigint CHECK (maximum_authorised_amount_minor IS NULL OR maximum_authorised_amount_minor >= 0),
  currency char(3),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  remaining_usage_indicator integer CHECK (remaining_usage_indicator IS NULL OR remaining_usage_indicator >= 0),
  exception_approver_role_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  acts_as_stored_money boolean NOT NULL DEFAULT false CHECK (acts_as_stored_money = false),
  decides_statutory_eligibility boolean NOT NULL DEFAULT false CHECK (decides_statutory_eligibility = false),
  passenger_personal_liability_fallback boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_fallback = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, authorisation_key, version),
  CHECK ((managed_passenger_profile_id IS NOT NULL) <> (passenger_group_reference IS NOT NULL)),
  CHECK (btrim(authorisation_key) <> '' AND cardinality(permitted_service_types) > 0),
  CHECK (cardinality(permitted_journey_purposes) > 0),
  CHECK ((maximum_authorised_amount_minor IS NULL) = (currency IS NULL)),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_funding_authorisation
  ON organisation.funding_authorisation_version (organisation_id, authorisation_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS funding_authorisation_update_guard ON organisation.funding_authorisation_version;
CREATE TRIGGER funding_authorisation_update_guard BEFORE UPDATE ON organisation.funding_authorisation_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS funding_authorisation_delete_guard ON organisation.funding_authorisation_version;
CREATE TRIGGER funding_authorisation_delete_guard BEFORE DELETE ON organisation.funding_authorisation_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.booking_template_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  template_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  managed_passenger_profile_id uuid REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  authorised_passenger_group_reference text,
  service_type text NOT NULL CHECK (service_type IN ('STANDARD','WAV','ASSISTED','SCHOOL_TRANSPORT','AIRPORT','BUSINESS','EXECUTIVE','OTHER_CONFIGURED_SERVICE')),
  pickup_definition jsonb NOT NULL,
  destination_definition jsonb NOT NULL,
  schedule_rule jsonb NOT NULL,
  booking_party_rules jsonb NOT NULL,
  requirements_snapshot_source text NOT NULL,
  funding_authorisation_version_id uuid REFERENCES organisation.funding_authorisation_version(id) ON DELETE RESTRICT,
  communication_plan_reference text NOT NULL,
  agreement_version_id uuid NOT NULL REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  service_policy_version_id uuid NOT NULL REFERENCES organisation.organisation_service_policy_version(id) ON DELETE RESTRICT,
  reserves_driver boolean NOT NULL DEFAULT false CHECK (reserves_driver = false),
  creates_finance_liability boolean NOT NULL DEFAULT false CHECK (creates_finance_liability = false),
  is_canonical_booking boolean NOT NULL DEFAULT false CHECK (is_canonical_booking = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, template_key, version),
  CHECK ((managed_passenger_profile_id IS NOT NULL) <> (authorised_passenger_group_reference IS NOT NULL)),
  CHECK (btrim(template_key) <> '' AND btrim(requirements_snapshot_source) <> ''),
  CHECK (btrim(communication_plan_reference) <> ''),
  CHECK (jsonb_typeof(pickup_definition) = 'object' AND jsonb_typeof(destination_definition) = 'object'),
  CHECK (jsonb_typeof(schedule_rule) = 'object' AND jsonb_typeof(booking_party_rules) = 'object'),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_template
  ON organisation.booking_template_version (organisation_id, template_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS booking_template_update_guard ON organisation.booking_template_version;
CREATE TRIGGER booking_template_update_guard BEFORE UPDATE ON organisation.booking_template_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS booking_template_delete_guard ON organisation.booking_template_version;
CREATE TRIGGER booking_template_delete_guard BEFORE DELETE ON organisation.booking_template_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.booking_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  series_key text NOT NULL,
  initial_template_version_id uuid NOT NULL REFERENCES organisation.booking_template_version(id) ON DELETE RESTRICT,
  generation_horizon_days integer NOT NULL CHECK (generation_horizon_days > 0),
  recurrence_structured boolean NOT NULL DEFAULT true CHECK (recurrence_structured = true),
  status text NOT NULL CHECK (status IN ('ACTIVE','ENDED')),
  created_by_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, series_key),
  CHECK (btrim(series_key) <> '')
);

DROP TRIGGER IF EXISTS booking_series_immutable ON organisation.booking_series;
CREATE TRIGGER booking_series_immutable BEFORE UPDATE OR DELETE ON organisation.booking_series
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.booking_series_amendment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  booking_series_id uuid NOT NULL REFERENCES organisation.booking_series(id) ON DELETE RESTRICT,
  amendment_sequence bigint NOT NULL CHECK (amendment_sequence > 0),
  change_scope text NOT NULL CHECK (change_scope IN ('THIS_OCCURRENCE_ONLY','THIS_AND_FUTURE_OCCURRENCES','ENTIRE_SERIES')),
  target_occurrence_date date,
  previous_template_version_id uuid NOT NULL REFERENCES organisation.booking_template_version(id) ON DELETE RESTRICT,
  new_template_version_id uuid REFERENCES organisation.booking_template_version(id) ON DELETE RESTRICT,
  actor_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  completed_booking_changed boolean NOT NULL DEFAULT false CHECK (completed_booking_changed = false),
  active_journey_changed_directly boolean NOT NULL DEFAULT false CHECK (active_journey_changed_directly = false),
  requirements_revalidated boolean NOT NULL,
  funding_revalidated boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_series_id, amendment_sequence),
  CHECK (btrim(reason) <> ''),
  CHECK (change_scope <> 'THIS_OCCURRENCE_ONLY' OR target_occurrence_date IS NOT NULL),
  CHECK (change_scope = 'THIS_OCCURRENCE_ONLY' OR new_template_version_id IS NOT NULL)
);

DROP TRIGGER IF EXISTS booking_series_amendment_immutable ON organisation.booking_series_amendment;
CREATE TRIGGER booking_series_amendment_immutable BEFORE UPDATE OR DELETE ON organisation.booking_series_amendment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.booking_occurrence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  booking_series_id uuid NOT NULL REFERENCES organisation.booking_series(id) ON DELETE RESTRICT,
  occurrence_key text NOT NULL,
  service_date date NOT NULL,
  canonical_booking_id uuid NOT NULL UNIQUE REFERENCES booking.booking(id) ON DELETE RESTRICT,
  template_version_id uuid NOT NULL REFERENCES organisation.booking_template_version(id) ON DELETE RESTRICT,
  agreement_version_id uuid NOT NULL REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  service_policy_version_id uuid NOT NULL REFERENCES organisation.organisation_service_policy_version(id) ON DELETE RESTRICT,
  funding_authorisation_version_id uuid REFERENCES organisation.funding_authorisation_version(id) ON DELETE RESTRICT,
  generation_command_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_series_id, occurrence_key),
  CHECK (btrim(occurrence_key) <> '')
);

DROP TRIGGER IF EXISTS booking_occurrence_immutable ON organisation.booking_occurrence;
CREATE TRIGGER booking_occurrence_immutable BEFORE UPDATE OR DELETE ON organisation.booking_occurrence
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.school_calendar_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  calendar_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  academic_year_label text NOT NULL,
  calendar_type text NOT NULL CHECK (calendar_type IN ('SCHOOL','TERM','ORGANISATION_SERVICE')),
  timezone text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, calendar_key, version),
  CHECK (btrim(calendar_key) <> '' AND btrim(academic_year_label) <> '' AND btrim(timezone) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_school_calendar
  ON organisation.school_calendar_version (organisation_id, calendar_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS school_calendar_update_guard ON organisation.school_calendar_version;
CREATE TRIGGER school_calendar_update_guard BEFORE UPDATE ON organisation.school_calendar_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS school_calendar_delete_guard ON organisation.school_calendar_version;
CREATE TRIGGER school_calendar_delete_guard BEFORE DELETE ON organisation.school_calendar_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.school_calendar_date (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  calendar_version_id uuid NOT NULL REFERENCES organisation.school_calendar_version(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  date_type text NOT NULL CHECK (date_type IN ('TERM_DAY','INSET_TRAINING','HOLIDAY','CLOSURE','ONE_OFF_SERVICE','OTHER_EXCEPTION')),
  service_allowed boolean NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_version_id, service_date),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS school_calendar_date_immutable ON organisation.school_calendar_date;
CREATE TRIGGER school_calendar_date_immutable BEFORE UPDATE OR DELETE ON organisation.school_calendar_date
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.scheduled_pickup_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL UNIQUE REFERENCES booking.booking(id) ON DELETE RESTRICT,
  earliest_at timestamptz NOT NULL,
  target_at timestamptz NOT NULL,
  latest_at timestamptz NOT NULL,
  readiness_required boolean NOT NULL DEFAULT false,
  guaranteed_instant_collection boolean NOT NULL DEFAULT false CHECK (guaranteed_instant_collection = false),
  policy_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (earliest_at <= target_at AND target_at <= latest_at),
  CHECK (btrim(policy_reference) <> '')
);

DROP TRIGGER IF EXISTS scheduled_pickup_window_immutable ON organisation.scheduled_pickup_window;
CREATE TRIGGER scheduled_pickup_window_immutable BEFORE UPDATE OR DELETE ON organisation.scheduled_pickup_window
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.passenger_readiness_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  readiness text NOT NULL CHECK (readiness IN ('NOT_READY','READY')),
  state_version bigint NOT NULL CHECK (state_version > 0),
  actor_type text NOT NULL,
  actor_reference text NOT NULL,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  automatically_recorded_no_show boolean NOT NULL DEFAULT false CHECK (automatically_recorded_no_show = false),
  UNIQUE (canonical_booking_id, state_version),
  CHECK (btrim(actor_type) <> '' AND btrim(actor_reference) <> '')
);

DROP TRIGGER IF EXISTS passenger_readiness_event_immutable ON organisation.passenger_readiness_event;
CREATE TRIGGER passenger_readiness_event_immutable BEFORE UPDATE OR DELETE ON organisation.passenger_readiness_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_capacity_reservation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  service_date date NOT NULL,
  service_window tstzrange NOT NULL,
  required_capability text NOT NULL,
  reserved_capability text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  capability_match_confirmed boolean NOT NULL,
  creates_driver_assignment boolean NOT NULL DEFAULT false CHECK (creates_driver_assignment = false),
  evidence_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT isempty(service_window) AND lower_inc(service_window) AND NOT upper_inc(service_window)),
  CHECK (required_capability = reserved_capability),
  CHECK (btrim(evidence_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_capacity_reservation_immutable ON organisation.institutional_capacity_reservation;
CREATE TRIGGER institutional_capacity_reservation_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_capacity_reservation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.driver_schedule_conflict_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  driver_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  active_assignments_checked boolean NOT NULL,
  scheduled_work_checked boolean NOT NULL,
  travel_time_checked boolean NOT NULL,
  maintenance_checked boolean NOT NULL,
  fatigue_rest_checked boolean NOT NULL,
  service_commitments_checked boolean NOT NULL,
  conflict_present boolean NOT NULL,
  evidence_reference text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(evidence_reference) <> ''),
  CHECK (NOT conflict_present OR evidence_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS driver_schedule_conflict_assessment_immutable ON organisation.driver_schedule_conflict_assessment;
CREATE TRIGGER driver_schedule_conflict_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.driver_schedule_conflict_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.bulk_passenger_import_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  requested_by_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  source_hash char(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('UPLOADED','VALIDATING','VALIDATED_WITH_WARNINGS','REJECTED','READY_TO_COMMIT','COMMITTED','PARTIALLY_COMMITTED')),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  dry_run_completed boolean NOT NULL DEFAULT false,
  duplicate_detection_completed boolean NOT NULL DEFAULT false,
  every_row_outcome_visible boolean NOT NULL DEFAULT false,
  partial_commit_policy_allows boolean NOT NULL DEFAULT false,
  cross_tenant_relationship_disclosed boolean NOT NULL DEFAULT false CHECK (cross_tenant_relationship_disclosed = false),
  external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, idempotency_key),
  CHECK (btrim(idempotency_key) <> ''),
  CHECK (status NOT IN ('READY_TO_COMMIT','COMMITTED','PARTIALLY_COMMITTED') OR (dry_run_completed AND duplicate_detection_completed AND every_row_outcome_visible)),
  CHECK (status <> 'PARTIALLY_COMMITTED' OR partial_commit_policy_allows)
);

CREATE TABLE IF NOT EXISTS organisation.bulk_passenger_import_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES organisation.bulk_passenger_import_batch(id) ON DELETE RESTRICT,
  row_number integer NOT NULL CHECK (row_number > 0),
  row_hash char(64) NOT NULL CHECK (row_hash ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('VALID','WARNING','INVALID','DUPLICATE_WITHIN_TENANT','COMMITTED','NOT_COMMITTED')),
  error_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  other_tenant_relationship_revealed boolean NOT NULL DEFAULT false CHECK (other_tenant_relationship_revealed = false),
  committed_membership_id uuid REFERENCES organisation.organisation_passenger_membership(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);

DROP TRIGGER IF EXISTS bulk_passenger_import_row_immutable ON organisation.bulk_passenger_import_row;
CREATE TRIGGER bulk_passenger_import_row_immutable BEFORE UPDATE OR DELETE ON organisation.bulk_passenger_import_row
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.bulk_booking_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  requested_by_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('UPLOADED','VALIDATING','VALIDATED_WITH_WARNINGS','REJECTED','READY_TO_COMMIT','COMMITTED','PARTIALLY_COMMITTED')),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  dry_run_completed boolean NOT NULL DEFAULT false,
  duplicate_detection_completed boolean NOT NULL DEFAULT false,
  every_row_outcome_visible boolean NOT NULL DEFAULT false,
  partial_commit_policy_allows boolean NOT NULL DEFAULT false,
  creates_journey_or_payment_directly boolean NOT NULL DEFAULT false CHECK (creates_journey_or_payment_directly = false),
  external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, idempotency_key),
  CHECK (btrim(idempotency_key) <> ''),
  CHECK (status NOT IN ('READY_TO_COMMIT','COMMITTED','PARTIALLY_COMMITTED') OR (dry_run_completed AND duplicate_detection_completed AND every_row_outcome_visible)),
  CHECK (status <> 'PARTIALLY_COMMITTED' OR partial_commit_policy_allows)
);

CREATE TABLE IF NOT EXISTS organisation.bulk_booking_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES organisation.bulk_booking_batch(id) ON DELETE RESTRICT,
  row_number integer NOT NULL CHECK (row_number > 0),
  row_hash char(64) NOT NULL CHECK (row_hash ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('VALID','WARNING','INVALID','DUPLICATE','COMMITTED','NOT_COMMITTED')),
  booking_authority_valid boolean NOT NULL,
  passenger_service_eligible boolean NOT NULL,
  funding_valid boolean NOT NULL,
  schedule_valid boolean NOT NULL,
  error_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  canonical_booking_id uuid UNIQUE REFERENCES booking.booking(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number),
  CHECK (outcome <> 'COMMITTED' OR canonical_booking_id IS NOT NULL)
);

DROP TRIGGER IF EXISTS bulk_booking_row_immutable ON organisation.bulk_booking_row;
CREATE TRIGGER bulk_booking_row_immutable BEFORE UPDATE OR DELETE ON organisation.bulk_booking_row
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.bulk_batch_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  batch_kind text NOT NULL CHECK (batch_kind IN ('PASSENGER_IMPORT','BOOKING')),
  batch_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  batch_version bigint NOT NULL CHECK (batch_version > 0),
  actor_membership_id uuid REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_kind, batch_id, batch_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS bulk_batch_status_event_immutable ON organisation.bulk_batch_status_event;
CREATE TRIGGER bulk_batch_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.bulk_batch_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_bulk_batch_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'state_version' - 'dry_run_completed'
      - 'duplicate_detection_completed' - 'every_row_outcome_visible'
      - 'partial_commit_policy_allows' - 'updated_at')
     IS DISTINCT FROM
     (to_jsonb(NEW) - 'status' - 'state_version' - 'dry_run_completed'
      - 'duplicate_detection_completed' - 'every_row_outcome_visible'
      - 'partial_commit_policy_allows' - 'updated_at') THEN
    RAISE EXCEPTION 'Institutional bulk batch identity is immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Bulk batch update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'UPLOADED' AND NEW.status IN ('VALIDATING','REJECTED'))
    OR (OLD.status = 'VALIDATING' AND NEW.status IN ('VALIDATED_WITH_WARNINGS','READY_TO_COMMIT','REJECTED'))
    OR (OLD.status = 'VALIDATED_WITH_WARNINGS' AND NEW.status IN ('READY_TO_COMMIT','REJECTED'))
    OR (OLD.status = 'READY_TO_COMMIT' AND NEW.status IN ('COMMITTED','PARTIALLY_COMMITTED','REJECTED'))
  ) THEN RAISE EXCEPTION 'Invalid institutional bulk batch transition'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.bulk_batch_status_event event
     WHERE event.batch_id = NEW.id AND event.batch_version = NEW.state_version
       AND event.batch_kind = CASE WHEN TG_TABLE_NAME = 'bulk_passenger_import_batch' THEN 'PASSENGER_IMPORT' ELSE 'BOOKING' END
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Bulk batch update requires matching status evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bulk_passenger_import_batch_update_guard ON organisation.bulk_passenger_import_batch;
CREATE CONSTRAINT TRIGGER bulk_passenger_import_batch_update_guard AFTER UPDATE ON organisation.bulk_passenger_import_batch
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_bulk_batch_update();
DROP TRIGGER IF EXISTS bulk_passenger_import_batch_delete_guard ON organisation.bulk_passenger_import_batch;
CREATE TRIGGER bulk_passenger_import_batch_delete_guard BEFORE DELETE ON organisation.bulk_passenger_import_batch
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS bulk_booking_batch_update_guard ON organisation.bulk_booking_batch;
CREATE CONSTRAINT TRIGGER bulk_booking_batch_update_guard AFTER UPDATE ON organisation.bulk_booking_batch
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_bulk_batch_update();
DROP TRIGGER IF EXISTS bulk_booking_batch_delete_guard ON organisation.bulk_booking_batch;
CREATE TRIGGER bulk_booking_batch_delete_guard BEFORE DELETE ON organisation.bulk_booking_batch
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.passenger_substitution_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  from_managed_passenger_profile_id uuid NOT NULL REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  to_managed_passenger_profile_id uuid NOT NULL REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  active_journey boolean NOT NULL,
  authorised_relationship_revalidated boolean NOT NULL,
  service_eligibility_revalidated boolean NOT NULL,
  requirements_revalidated boolean NOT NULL,
  funding_revalidated boolean NOT NULL,
  communications_revalidated boolean NOT NULL,
  canonical_workflow_used boolean NOT NULL DEFAULT true CHECK (canonical_workflow_used = true),
  outcome text NOT NULL CHECK (outcome IN ('ALLOWED_FUTURE_BOOKING','REJECTED_ACTIVE_JOURNEY','REJECTED_AUTHORITY')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_managed_passenger_profile_id <> to_managed_passenger_profile_id),
  CHECK (NOT active_journey OR outcome = 'REJECTED_ACTIVE_JOURNEY')
);

DROP TRIGGER IF EXISTS passenger_substitution_decision_immutable ON organisation.passenger_substitution_decision;
CREATE TRIGGER passenger_substitution_decision_immutable BEFORE UPDATE OR DELETE ON organisation.passenger_substitution_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_cancellation_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('PASSENGER_UNAVAILABLE','ORGANISATION_CANCELLED','APPOINTMENT_CANCELLED','SCHOOL_CLOSED','SERVICE_NO_LONGER_REQUIRED','DUPLICATE_BOOKING','OTHER_STRUCTURED_REASON')),
  canonical_booking_transition_id uuid NOT NULL,
  service_specific_no_show_policy_reference text NOT NULL,
  passenger_not_ready_misclassified_as_no_show boolean NOT NULL DEFAULT false CHECK (passenger_not_ready_misclassified_as_no_show = false),
  active_journey_cancelled_by_portal boolean NOT NULL DEFAULT false CHECK (active_journey_cancelled_by_portal = false),
  portal_calculated_charge boolean NOT NULL DEFAULT false CHECK (portal_calculated_charge = false),
  finance_policy_reference text,
  actor_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(service_specific_no_show_policy_reference) <> '')
);

DROP TRIGGER IF EXISTS institutional_cancellation_decision_immutable ON organisation.institutional_cancellation_decision;
CREATE TRIGGER institutional_cancellation_decision_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_cancellation_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_transport_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  exception_type text NOT NULL CHECK (exception_type IN ('MISSING_BOOKING_AUTHORITY','FUNDING_EXPIRED','SERVICE_REQUIREMENT_UNAVAILABLE','PASSENGER_CONTACT_UNAVAILABLE','SCHEDULE_CONFLICT','NO_ELIGIBLE_DRIVER','APPROVAL_REQUIRED','ROSTER_EXPIRED','DATA_VALIDATION_ERROR')),
  status text NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED')),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  next_action text NOT NULL,
  resolution_outcome text,
  canonical_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  managed_passenger_profile_id uuid REFERENCES organisation.managed_passenger_profile(id) ON DELETE RESTRICT,
  attention_at timestamptz NOT NULL,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  replaces_safety_or_safeguarding_case boolean NOT NULL DEFAULT false CHECK (replaces_safety_or_safeguarding_case = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(next_action) <> ''),
  CHECK (priority NOT IN ('P0','P1') OR owner_person_id IS NOT NULL),
  CHECK (status NOT IN ('RESOLVED','CLOSED') OR resolution_outcome IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS organisation.transport_exception_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  exception_id uuid NOT NULL REFERENCES organisation.organisation_transport_exception(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED')),
  exception_version bigint NOT NULL CHECK (exception_version > 0),
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exception_id, exception_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS transport_exception_status_event_immutable ON organisation.transport_exception_status_event;
CREATE TRIGGER transport_exception_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.transport_exception_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_transport_exception_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.exception_type IS DISTINCT FROM NEW.exception_type
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.canonical_booking_id IS DISTINCT FROM NEW.canonical_booking_id
     OR OLD.managed_passenger_profile_id IS DISTINCT FROM NEW.managed_passenger_profile_id
     OR OLD.replaces_safety_or_safeguarding_case IS DISTINCT FROM NEW.replaces_safety_or_safeguarding_case
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Institutional transport exception identity, priority and links are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Transport exception update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'OPEN' AND NEW.status IN ('IN_PROGRESS','WAITING','RESOLVED','CLOSED'))
    OR (OLD.status = 'IN_PROGRESS' AND NEW.status IN ('WAITING','RESOLVED','CLOSED'))
    OR (OLD.status = 'WAITING' AND NEW.status IN ('IN_PROGRESS','RESOLVED','CLOSED'))
    OR (OLD.status = 'RESOLVED' AND NEW.status = 'CLOSED')
  ) THEN RAISE EXCEPTION 'Invalid institutional transport exception transition'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.transport_exception_status_event event
     WHERE event.exception_id = NEW.id AND event.exception_version = NEW.state_version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Transport exception update requires matching status evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transport_exception_update_guard ON organisation.organisation_transport_exception;
CREATE CONSTRAINT TRIGGER transport_exception_update_guard AFTER UPDATE ON organisation.organisation_transport_exception
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_transport_exception_update();
DROP TRIGGER IF EXISTS transport_exception_delete_guard ON organisation.organisation_transport_exception;
CREATE TRIGGER transport_exception_delete_guard BEFORE DELETE ON organisation.organisation_transport_exception
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_booking_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  canonical_booking_id uuid NOT NULL UNIQUE REFERENCES booking.booking(id) ON DELETE RESTRICT,
  requested_by_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES organisation.organisation_site(id) ON DELETE RESTRICT,
  passenger_membership_id uuid NOT NULL REFERENCES organisation.organisation_passenger_membership(id) ON DELETE RESTRICT,
  booking_authority_rule_version_id uuid NOT NULL REFERENCES organisation.booking_authority_rule_version(id) ON DELETE RESTRICT,
  funding_authorisation_version_id uuid REFERENCES organisation.funding_authorisation_version(id) ON DELETE RESTRICT,
  agreement_version_id uuid NOT NULL REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  service_policy_version_id uuid NOT NULL REFERENCES organisation.organisation_service_policy_version(id) ON DELETE RESTRICT,
  template_version_id uuid REFERENCES organisation.booking_template_version(id) ON DELETE RESTRICT,
  occurrence_id uuid REFERENCES organisation.booking_occurrence(id) ON DELETE RESTRICT,
  amendments jsonb NOT NULL DEFAULT '[]'::jsonb,
  journey_or_payment_written_directly boolean NOT NULL DEFAULT false CHECK (journey_or_payment_written_directly = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(amendments) = 'array')
);

DROP TRIGGER IF EXISTS institutional_booking_provenance_immutable ON organisation.institutional_booking_provenance;
CREATE TRIGGER institutional_booking_provenance_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_booking_provenance
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_acceptance_case_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL CHECK (scenario_key IN (
    'MULTI_ORGANISATION_PASSENGER_ISOLATION','ROSTER_REMOVAL_PRESERVES_IDENTITY',
    'EXPIRED_FUNDING_ROUTES_TO_EXCEPTION','TEN_CANONICAL_RECURRING_OCCURRENCES',
    'ONE_OCCURRENCE_CHANGE_ISOLATED','FUTURE_SERIES_CHANGE_PRESERVES_HISTORY',
    'SCHOOL_CLOSURE_STRUCTURED_BULK_CHANGE','INELIGIBLE_PREFERRED_DRIVER_REPLACED',
    'WAV_DOWNGRADE_REJECTED','BULK_DUPLICATES_ROW_LEVEL_NO_LEAKAGE',
    'BULK_REPLAY_DEDUPLICATED','HOSPITAL_NOT_READY_NOT_NO_SHOW',
    'LATER_READY_USES_CURRENT_STATE','FUTURE_PASSENGER_SUBSTITUTION_REVALIDATED',
    'ACTIVE_JOURNEY_PASSENGER_RELABEL_REJECTED','BREAKDOWN_PRESERVES_CANONICAL_JOURNEY',
    'INSTITUTIONAL_REPORT_MINIMISED','ROSTER_END_DISPOSES_FUTURE_PRESERVES_HISTORY'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  condition_description text NOT NULL,
  pass_criteria text NOT NULL,
  fixture_only boolean NOT NULL DEFAULT true CHECK (fixture_only = true),
  institutional_mutation_execution_allowed boolean NOT NULL DEFAULT false CHECK (institutional_mutation_execution_allowed = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_key, version),
  CHECK (btrim(condition_description) <> '' AND btrim(pass_criteria) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_institutional_acceptance_case
  ON organisation.institutional_acceptance_case_version (scenario_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS institutional_acceptance_case_update_guard ON organisation.institutional_acceptance_case_version;
CREATE TRIGGER institutional_acceptance_case_update_guard BEFORE UPDATE ON organisation.institutional_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS institutional_acceptance_case_delete_guard ON organisation.institutional_acceptance_case_version;
CREATE TRIGGER institutional_acceptance_case_delete_guard BEFORE DELETE ON organisation.institutional_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_command_deduplication (
  command_id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, command_type, idempotency_key),
  CHECK (btrim(command_type) <> '' AND btrim(idempotency_key) <> '')
);

DROP TRIGGER IF EXISTS institutional_command_deduplication_immutable ON organisation.institutional_command_deduplication;
CREATE TRIGGER institutional_command_deduplication_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_transport_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'PassengerRosterMembershipCreated.v1','PassengerRosterMembershipEnded.v1','PassengerRequirementsChanged.v1',
    'BookingAuthorityGranted.v1','BookingAuthorityRevoked.v1','FundingAuthorisationActivated.v1',
    'FundingAuthorisationExpired.v1','BookingTemplateCreated.v1','BookingTemplateVersioned.v1',
    'BookingOccurrenceGenerated.v1','BookingSeriesAmended.v1','BulkPassengerImportValidated.v1',
    'BulkPassengerImportCommitted.v1','BulkBookingBatchCommitted.v1','InstitutionalBookingCreated.v1',
    'PassengerMarkedReady.v1','OrganisationTransportExceptionOpened.v1','OrganisationTransportExceptionResolved.v1'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosis_or_cross_tenant_relationship_included boolean NOT NULL DEFAULT false CHECK (diagnosis_or_cross_tenant_relationship_included = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type),
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS institutional_transport_event_immutable ON organisation.institutional_transport_event;
CREATE TRIGGER institutional_transport_event_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_transport_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.institutional_transport_outbox_message (
  event_id uuid PRIMARY KEY REFERENCES organisation.institutional_transport_event(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS institutional_transport_outbox_message_immutable ON organisation.institutional_transport_outbox_message;
CREATE TRIGGER institutional_transport_outbox_message_immutable BEFORE UPDATE OR DELETE ON organisation.institutional_transport_outbox_message
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
