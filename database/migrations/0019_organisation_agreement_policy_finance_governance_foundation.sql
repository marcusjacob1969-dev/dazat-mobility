-- DAZAT Mobility — Engineering Phase 0.19
-- Organisation Operations Part 3: agreement lifecycle, policy precedence,
-- approvals, billing relationships, SLA governance, integrations and exit controls.
-- Commercial configuration never owns canonical Booking, Journey or Finance truth.

CREATE OR REPLACE FUNCTION organisation.guard_commercial_version_close_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'effective_to') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'effective_to') THEN
    RAISE EXCEPTION 'Versioned commercial content is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('SUPERSEDED','REVOKED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'Commercial version only permits one ACTIVE close transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS organisation.organisation_agreement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_key text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'PROSPECT','DUE_DILIGENCE','DRAFT','INTERNAL_REVIEW','CUSTOMER_REVIEW','APPROVED',
    'ACTIVE','RENEWAL_DUE','RENEWED','VARIED','SUSPENDED','EXPIRED','TERMINATED'
  )),
  current_agreement_version_id uuid REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  contract_status_is_operational_organisation_status boolean NOT NULL DEFAULT false CHECK (contract_status_is_operational_organisation_status = false),
  effective_start timestamptz,
  effective_end timestamptz,
  future_bookings_classified boolean NOT NULL DEFAULT false,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, agreement_key),
  CHECK (btrim(agreement_key) <> ''),
  CHECK (effective_end IS NULL OR (effective_start IS NOT NULL AND effective_end > effective_start)),
  CHECK (status NOT IN ('ACTIVE','RENEWAL_DUE','RENEWED','VARIED','SUSPENDED','EXPIRED','TERMINATED') OR current_agreement_version_id IS NOT NULL),
  CHECK (status NOT IN ('ACTIVE','RENEWAL_DUE','RENEWED','VARIED') OR effective_start IS NOT NULL),
  CHECK (status NOT IN ('RENEWAL_DUE','EXPIRED','TERMINATED') OR future_bookings_classified)
);

CREATE TABLE IF NOT EXISTS organisation.organisation_agreement_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN (
    'PROSPECT','DUE_DILIGENCE','DRAFT','INTERNAL_REVIEW','CUSTOMER_REVIEW','APPROVED',
    'ACTIVE','RENEWAL_DUE','RENEWED','VARIED','SUSPENDED','EXPIRED','TERMINATED'
  )),
  agreement_version bigint NOT NULL CHECK (agreement_version > 0),
  authoritative_agreement_version_id uuid REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  effective_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, agreement_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS organisation_agreement_status_event_immutable ON organisation.organisation_agreement_status_event;
CREATE TRIGGER organisation_agreement_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_agreement_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_commercial_agreement_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'current_agreement_version_id' - 'effective_start' - 'effective_end' - 'future_bookings_classified' - 'state_version' - 'updated_at')
     IS DISTINCT FROM
     (to_jsonb(NEW) - 'status' - 'current_agreement_version_id' - 'effective_start' - 'effective_end' - 'future_bookings_classified' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Organisation agreement identity and status separation are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Organisation agreement update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'PROSPECT' AND NEW.status IN ('DUE_DILIGENCE','DRAFT','TERMINATED'))
    OR (OLD.status = 'DUE_DILIGENCE' AND NEW.status IN ('DRAFT','TERMINATED'))
    OR (OLD.status = 'DRAFT' AND NEW.status IN ('INTERNAL_REVIEW','TERMINATED'))
    OR (OLD.status = 'INTERNAL_REVIEW' AND NEW.status IN ('DRAFT','CUSTOMER_REVIEW','APPROVED','TERMINATED'))
    OR (OLD.status = 'CUSTOMER_REVIEW' AND NEW.status IN ('DRAFT','INTERNAL_REVIEW','APPROVED','TERMINATED'))
    OR (OLD.status = 'APPROVED' AND NEW.status IN ('ACTIVE','TERMINATED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('RENEWAL_DUE','VARIED','SUSPENDED','EXPIRED','TERMINATED'))
    OR (OLD.status = 'RENEWAL_DUE' AND NEW.status IN ('RENEWED','VARIED','SUSPENDED','EXPIRED','TERMINATED'))
    OR (OLD.status IN ('RENEWED','VARIED') AND NEW.status IN ('ACTIVE','SUSPENDED','EXPIRED','TERMINATED'))
    OR (OLD.status = 'SUSPENDED' AND NEW.status IN ('ACTIVE','EXPIRED','TERMINATED'))
  ) THEN RAISE EXCEPTION 'Invalid organisation agreement transition'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.organisation_agreement_status_event event
     WHERE event.agreement_id = NEW.id AND event.agreement_version = NEW.state_version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Organisation agreement update requires matching status evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_commercial_agreement_update_guard ON organisation.organisation_agreement;
CREATE CONSTRAINT TRIGGER organisation_commercial_agreement_update_guard AFTER UPDATE ON organisation.organisation_agreement
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_commercial_agreement_update();
DROP TRIGGER IF EXISTS organisation_commercial_agreement_delete_guard ON organisation.organisation_agreement;
CREATE TRIGGER organisation_commercial_agreement_delete_guard BEFORE DELETE ON organisation.organisation_agreement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_pricing_schedule_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  schedule_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  pricing_context jsonb NOT NULL,
  currency_code text NOT NULL,
  canonical_pricing_engine_reference text NOT NULL,
  owns_ledger_truth boolean NOT NULL DEFAULT false CHECK (owns_ledger_truth = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, schedule_key, version),
  CHECK (btrim(schedule_key) <> '' AND btrim(currency_code) <> '' AND btrim(canonical_pricing_engine_reference) <> ''),
  CHECK (jsonb_typeof(pricing_context) = 'object'),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_pricing_schedule
  ON organisation.organisation_pricing_schedule_version (organisation_id, schedule_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_pricing_schedule_update_guard ON organisation.organisation_pricing_schedule_version;
CREATE TRIGGER organisation_pricing_schedule_update_guard BEFORE UPDATE ON organisation.organisation_pricing_schedule_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_commercial_version_close_update();
DROP TRIGGER IF EXISTS organisation_pricing_schedule_delete_guard ON organisation.organisation_pricing_schedule_version;
CREATE TRIGGER organisation_pricing_schedule_delete_guard BEFORE DELETE ON organisation.organisation_pricing_schedule_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_billing_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  invoice_cadence text NOT NULL CHECK (invoice_cadence IN ('PER_JOURNEY','WEEKLY','MONTHLY','STATEMENT_PERIOD','CONTRACT_DEFINED')),
  grouping_dimensions text[] NOT NULL,
  required_reference_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  correction_uses_finance_entries boolean NOT NULL DEFAULT true CHECK (correction_uses_finance_entries = true),
  direct_invoice_total_edit_allowed boolean NOT NULL DEFAULT false CHECK (direct_invoice_total_edit_allowed = false),
  passenger_personal_liability_fallback_allowed boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_fallback_allowed = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, policy_key, version),
  CHECK (btrim(policy_key) <> '' AND cardinality(grouping_dimensions) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_billing_policy
  ON organisation.organisation_billing_policy_version (organisation_id, policy_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_billing_policy_update_guard ON organisation.organisation_billing_policy_version;
CREATE TRIGGER organisation_billing_policy_update_guard BEFORE UPDATE ON organisation.organisation_billing_policy_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_commercial_version_close_update();
DROP TRIGGER IF EXISTS organisation_billing_policy_delete_guard ON organisation.organisation_billing_policy_version;
CREATE TRIGGER organisation_billing_policy_delete_guard BEFORE DELETE ON organisation.organisation_billing_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.billing_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  billing_policy_version_id uuid NOT NULL REFERENCES organisation.organisation_billing_policy_version(id) ON DELETE RESTRICT,
  account_key text NOT NULL,
  legal_entity_reference text NOT NULL,
  currency_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','WATCH','RESTRICTED','CLOSED')),
  ledger_account boolean NOT NULL DEFAULT false CHECK (ledger_account = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (organisation_id, account_key),
  CHECK (btrim(account_key) <> '' AND btrim(legal_entity_reference) <> '' AND btrim(currency_code) <> ''),
  CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION organisation.guard_billing_account_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'closed_at') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'closed_at') THEN
    RAISE EXCEPTION 'Billing account identity and policy scope are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'ACTIVE' AND NEW.status IN ('WATCH','RESTRICTED','CLOSED'))
    OR (OLD.status = 'WATCH' AND NEW.status IN ('ACTIVE','RESTRICTED','CLOSED'))
    OR (OLD.status = 'RESTRICTED' AND NEW.status IN ('ACTIVE','WATCH','CLOSED'))
  ) THEN RAISE EXCEPTION 'Invalid billing account transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_account_update_guard ON organisation.billing_account;
CREATE TRIGGER billing_account_update_guard BEFORE UPDATE ON organisation.billing_account
FOR EACH ROW EXECUTE FUNCTION organisation.guard_billing_account_update();
DROP TRIGGER IF EXISTS billing_account_delete_guard ON organisation.billing_account;
CREATE TRIGGER billing_account_delete_guard BEFORE DELETE ON organisation.billing_account
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.funding_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES organisation.billing_account(id) ON DELETE RESTRICT,
  cost_centre_version_id uuid REFERENCES organisation.cost_centre_version(id) ON DELETE RESTRICT,
  reference_type text NOT NULL CHECK (reference_type IN ('PROGRAMME','CONTRACT','CASE','ROUTE','DISCHARGE','FUNDING_CODE','OTHER_STRUCTURED')),
  reference_value text NOT NULL,
  format_validated boolean NOT NULL,
  passenger_personal_liability_created boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_created = false),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, reference_type, reference_value),
  CHECK (btrim(reference_value) <> ''),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

DROP TRIGGER IF EXISTS funding_reference_immutable ON organisation.funding_reference;
CREATE TRIGGER funding_reference_immutable BEFORE UPDATE OR DELETE ON organisation.funding_reference
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.purchase_order_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  funding_reference_id uuid NOT NULL REFERENCES organisation.funding_reference(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  reference_value text NOT NULL,
  format_validated boolean NOT NULL,
  urgent_exception_reference text,
  edits_closed_invoice boolean NOT NULL DEFAULT false CHECK (edits_closed_invoice = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(reference_value) <> ''),
  CHECK (format_validated OR urgent_exception_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS purchase_order_reference_immutable ON organisation.purchase_order_reference;
CREATE TRIGGER purchase_order_reference_immutable BEFORE UPDATE OR DELETE ON organisation.purchase_order_reference
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.reporting_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  permitted_purposes text[] NOT NULL,
  permitted_report_types text[] NOT NULL,
  sensitive_export_requires_step_up boolean NOT NULL DEFAULT true CHECK (sensitive_export_requires_step_up = true),
  raw_safety_default_allowed boolean NOT NULL DEFAULT false CHECK (raw_safety_default_allowed = false),
  diagnosis_default_allowed boolean NOT NULL DEFAULT false CHECK (diagnosis_default_allowed = false),
  unrestricted_surveillance_allowed boolean NOT NULL DEFAULT false CHECK (unrestricted_surveillance_allowed = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, policy_key, version),
  CHECK (btrim(policy_key) <> '' AND cardinality(permitted_purposes) > 0 AND cardinality(permitted_report_types) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_reporting_policy
  ON organisation.reporting_policy_version (organisation_id, policy_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS reporting_policy_update_guard ON organisation.reporting_policy_version;
CREATE TRIGGER reporting_policy_update_guard BEFORE UPDATE ON organisation.reporting_policy_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_commercial_version_close_update();
DROP TRIGGER IF EXISTS reporting_policy_delete_guard ON organisation.reporting_policy_version;
CREATE TRIGGER reporting_policy_delete_guard BEFORE DELETE ON organisation.reporting_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.service_level_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  metric_definitions jsonb NOT NULL,
  population_definition jsonb NOT NULL,
  measurement_window jsonb NOT NULL,
  targets jsonb NOT NULL,
  evidence_sources text[] NOT NULL,
  reporting_cadence text NOT NULL,
  exclusions_defined_in_advance boolean NOT NULL DEFAULT true CHECK (exclusions_defined_in_advance = true),
  target_claimed_as_guarantee boolean NOT NULL DEFAULT false CHECK (target_claimed_as_guarantee = false),
  safety_suppression_allowed boolean NOT NULL DEFAULT false CHECK (safety_suppression_allowed = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, policy_key, version),
  CHECK (btrim(policy_key) <> '' AND btrim(reporting_cadence) <> '' AND cardinality(evidence_sources) > 0),
  CHECK (jsonb_typeof(metric_definitions) = 'object' AND jsonb_typeof(population_definition) = 'object'),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_service_level_policy
  ON organisation.service_level_policy_version (organisation_id, policy_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS service_level_policy_update_guard ON organisation.service_level_policy_version;
CREATE TRIGGER service_level_policy_update_guard BEFORE UPDATE ON organisation.service_level_policy_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_commercial_version_close_update();
DROP TRIGGER IF EXISTS service_level_policy_delete_guard ON organisation.service_level_policy_version;
CREATE TRIGGER service_level_policy_delete_guard BEFORE DELETE ON organisation.service_level_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.service_level_measurement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  service_level_policy_version_id uuid NOT NULL REFERENCES organisation.service_level_policy_version(id) ON DELETE RESTRICT,
  metric_key text NOT NULL,
  population_window tstzrange NOT NULL,
  measured_value numeric NOT NULL,
  target_value numeric NOT NULL,
  evidence_source text NOT NULL,
  result text NOT NULL CHECK (result IN ('MET','MISSED','INSUFFICIENT_EVIDENCE')),
  data_quality_limitations text[] NOT NULL DEFAULT ARRAY[]::text[],
  stale_gps_used_as_proof boolean NOT NULL DEFAULT false CHECK (stale_gps_used_as_proof = false),
  canonical_classification_rewritten boolean NOT NULL DEFAULT false CHECK (canonical_classification_rewritten = false),
  safety_incident_suppressed boolean NOT NULL DEFAULT false CHECK (safety_incident_suppressed = false),
  measured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(metric_key) <> '' AND btrim(evidence_source) <> ''),
  CHECK (NOT isempty(population_window))
);

DROP TRIGGER IF EXISTS service_level_measurement_immutable ON organisation.service_level_measurement;
CREATE TRIGGER service_level_measurement_immutable BEFORE UPDATE OR DELETE ON organisation.service_level_measurement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.performance_causation_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  service_level_measurement_id uuid NOT NULL REFERENCES organisation.service_level_measurement(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  cause text NOT NULL CHECK (cause IN (
    'PASSENGER_NOT_READY','SITE_ACCESS_DELAY','ROAD_CLOSURE','PLATFORM_DISPATCH_DELAY',
    'PROVIDER_FAILURE','DRIVER_CAUSED_DELAY','UNKNOWN'
  )),
  evidence_references text[] NOT NULL,
  assessment_confidence text NOT NULL CHECK (assessment_confidence IN ('HIGH','MEDIUM','LOW','INSUFFICIENT')),
  driver_finding_created boolean NOT NULL DEFAULT false CHECK (driver_finding_created = false),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(evidence_references) > 0)
);

DROP TRIGGER IF EXISTS performance_causation_assessment_immutable ON organisation.performance_causation_assessment;
CREATE TRIGGER performance_causation_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.performance_causation_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_service_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  case_type text NOT NULL CHECK (case_type IN ('RECURRING_LATENESS','INVOICING','PORTAL_DEFECT','CAPACITY','CONTRACT_INTERPRETATION','BOOKING_PROCESS')),
  status text NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED')),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  next_action text NOT NULL,
  attention_at timestamptz NOT NULL,
  allegation_is_automatic_finding boolean NOT NULL DEFAULT false CHECK (allegation_is_automatic_finding = false),
  unrestricted_driver_or_passenger_case_access boolean NOT NULL DEFAULT false CHECK (unrestricted_driver_or_passenger_case_access = false),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(next_action) <> ''),
  CHECK (status NOT IN ('IN_PROGRESS','WAITING','RESOLVED','CLOSED') OR owner_person_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION organisation.guard_service_case_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'owner_person_id' - 'next_action' - 'attention_at' - 'state_version' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'owner_person_id' - 'next_action' - 'attention_at' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Organisation service case evidence and protection boundaries are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Organisation service case update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'OPEN' AND NEW.status IN ('IN_PROGRESS','WAITING','RESOLVED','CLOSED'))
    OR (OLD.status = 'IN_PROGRESS' AND NEW.status IN ('WAITING','RESOLVED','CLOSED'))
    OR (OLD.status = 'WAITING' AND NEW.status IN ('IN_PROGRESS','RESOLVED','CLOSED'))
    OR (OLD.status = 'RESOLVED' AND NEW.status = 'CLOSED')
  ) THEN RAISE EXCEPTION 'Invalid organisation service case transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_service_case_update_guard ON organisation.organisation_service_case;
CREATE TRIGGER organisation_service_case_update_guard BEFORE UPDATE ON organisation.organisation_service_case
FOR EACH ROW EXECUTE FUNCTION organisation.guard_service_case_update();
DROP TRIGGER IF EXISTS organisation_service_case_delete_guard ON organisation.organisation_service_case;
CREATE TRIGGER organisation_service_case_delete_guard BEFORE DELETE ON organisation.organisation_service_case
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.corrective_action_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  service_case_id uuid NOT NULL REFERENCES organisation.organisation_service_case(id) ON DELETE RESTRICT,
  owner_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  action text NOT NULL,
  deadline timestamptz NOT NULL,
  evidence_references text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETE','INEFFECTIVE','CANCELLED')),
  review_outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (btrim(action) <> ''),
  CHECK (cardinality(evidence_references) > 0),
  CHECK (deadline > created_at),
  CHECK (status NOT IN ('COMPLETE','INEFFECTIVE','CANCELLED') OR review_outcome IS NOT NULL)
);

CREATE OR REPLACE FUNCTION organisation.guard_corrective_action_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'review_outcome' - 'completed_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'review_outcome' - 'completed_at') THEN
    RAISE EXCEPTION 'Corrective action owner, action, deadline and evidence are immutable';
  END IF;
  IF OLD.status IN ('COMPLETE','INEFFECTIVE','CANCELLED') THEN RAISE EXCEPTION 'Corrective action is terminal'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS corrective_action_update_guard ON organisation.corrective_action_plan;
CREATE TRIGGER corrective_action_update_guard BEFORE UPDATE ON organisation.corrective_action_plan
FOR EACH ROW EXECUTE FUNCTION organisation.guard_corrective_action_update();
DROP TRIGGER IF EXISTS corrective_action_delete_guard ON organisation.corrective_action_plan;
CREATE TRIGGER corrective_action_delete_guard BEFORE DELETE ON organisation.corrective_action_plan
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.contract_change_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  proposed_agreement_version_id uuid NOT NULL REFERENCES organisation.organisation_agreement_version(id) ON DELETE RESTRICT,
  proposed_effective_at timestamptz NOT NULL,
  impacted_services text[] NOT NULL,
  pricing_change_reference text,
  approval_evidence_references text[] NOT NULL DEFAULT ARRAY[]::text[],
  implementation_owner_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT','SIMULATION_REQUIRED','REVIEW','APPROVED','REJECTED','ACTIVATED','CANCELLED')),
  completed_journeys_rewritten boolean NOT NULL DEFAULT false CHECK (completed_journeys_rewritten = false),
  active_journey_invalidated boolean NOT NULL DEFAULT false CHECK (active_journey_invalidated = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (proposed_effective_at > created_at AND cardinality(impacted_services) > 0),
  CHECK (status NOT IN ('APPROVED','ACTIVATED') OR cardinality(approval_evidence_references) > 0)
);

CREATE OR REPLACE FUNCTION organisation.guard_contract_change_request_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'approval_evidence_references')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'approval_evidence_references') THEN
    RAISE EXCEPTION 'Contract change proposal, effective date and protections are immutable';
  END IF;
  IF NOT (NEW.approval_evidence_references @> OLD.approval_evidence_references)
     OR cardinality(NEW.approval_evidence_references) < cardinality(OLD.approval_evidence_references) THEN
    RAISE EXCEPTION 'Contract change approval evidence cannot be removed';
  END IF;
  IF NOT (
    (OLD.status = 'DRAFT' AND NEW.status IN ('SIMULATION_REQUIRED','REVIEW','CANCELLED'))
    OR (OLD.status = 'SIMULATION_REQUIRED' AND NEW.status IN ('REVIEW','REJECTED','CANCELLED'))
    OR (OLD.status = 'REVIEW' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED'))
    OR (OLD.status = 'APPROVED' AND NEW.status IN ('ACTIVATED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'Invalid contract change request transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_change_request_update_guard ON organisation.contract_change_request;
CREATE TRIGGER contract_change_request_update_guard BEFORE UPDATE ON organisation.contract_change_request
FOR EACH ROW EXECUTE FUNCTION organisation.guard_contract_change_request_update();

DROP TRIGGER IF EXISTS contract_change_request_delete_guard ON organisation.contract_change_request;
CREATE TRIGGER contract_change_request_delete_guard BEFORE DELETE ON organisation.contract_change_request
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.contract_policy_simulation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  contract_change_request_id uuid NOT NULL REFERENCES organisation.contract_change_request(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
  total_future_bookings integer NOT NULL CHECK (total_future_bookings >= 0),
  classified_future_bookings integer NOT NULL CHECK (classified_future_bookings >= 0),
  production_writes_performed boolean NOT NULL DEFAULT false CHECK (production_writes_performed = false),
  completed_journey_mutations integer NOT NULL DEFAULT 0 CHECK (completed_journey_mutations = 0),
  active_journey_invalidations integer NOT NULL DEFAULT 0 CHECK (active_journey_invalidations = 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (classified_future_bookings <= total_future_bookings),
  CHECK (status <> 'COMPLETED' OR (completed_at IS NOT NULL AND classified_future_bookings = total_future_bookings))
);

CREATE OR REPLACE FUNCTION organisation.guard_contract_policy_simulation_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'classified_future_bookings' - 'started_at' - 'completed_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'classified_future_bookings' - 'started_at' - 'completed_at') THEN
    RAISE EXCEPTION 'Contract simulation scope and non-writing protections are immutable';
  END IF;
  IF NEW.classified_future_bookings < OLD.classified_future_bookings THEN
    RAISE EXCEPTION 'Contract simulation classified count cannot regress';
  END IF;
  IF NOT (
    (OLD.status = 'PENDING' AND NEW.status IN ('RUNNING','FAILED'))
    OR (OLD.status = 'RUNNING' AND NEW.status IN ('COMPLETED','FAILED'))
  ) THEN RAISE EXCEPTION 'Invalid contract policy simulation transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_policy_simulation_update_guard ON organisation.contract_policy_simulation;
CREATE TRIGGER contract_policy_simulation_update_guard BEFORE UPDATE ON organisation.contract_policy_simulation
FOR EACH ROW EXECUTE FUNCTION organisation.guard_contract_policy_simulation_update();

DROP TRIGGER IF EXISTS contract_policy_simulation_delete_guard ON organisation.contract_policy_simulation;
CREATE TRIGGER contract_policy_simulation_delete_guard BEFORE DELETE ON organisation.contract_policy_simulation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.contract_policy_simulation_impact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  simulation_id uuid NOT NULL REFERENCES organisation.contract_policy_simulation(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  booking_version bigint NOT NULL CHECK (booking_version > 0),
  impact text NOT NULL CHECK (impact IN ('ALLOWED','BLOCKED','APPROVAL_REQUIRED','FUNDING_INVALID','REVIEW_REQUIRED')),
  reason_codes text[] NOT NULL,
  accessibility_or_safeguarding_downgraded boolean NOT NULL DEFAULT false CHECK (accessibility_or_safeguarding_downgraded = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (simulation_id, booking_id),
  CHECK (cardinality(reason_codes) > 0)
);

DROP TRIGGER IF EXISTS contract_policy_simulation_impact_immutable ON organisation.contract_policy_simulation_impact;
CREATE TRIGGER contract_policy_simulation_impact_immutable BEFORE UPDATE OR DELETE ON organisation.contract_policy_simulation_impact
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.account_manager_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  account_manager_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  scope text[] NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  may_edit_ledger boolean NOT NULL DEFAULT false CHECK (may_edit_ledger = false),
  may_clear_compliance_restrictions boolean NOT NULL DEFAULT false CHECK (may_clear_compliance_restrictions = false),
  may_close_safeguarding_case boolean NOT NULL DEFAULT false CHECK (may_close_safeguarding_case = false),
  may_override_dispatch_filter boolean NOT NULL DEFAULT false CHECK (may_override_dispatch_filter = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(scope) > 0),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

DROP TRIGGER IF EXISTS account_manager_assignment_immutable ON organisation.account_manager_assignment;
CREATE TRIGGER account_manager_assignment_immutable BEFORE UPDATE OR DELETE ON organisation.account_manager_assignment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.service_credit_instruction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  service_level_measurement_id uuid REFERENCES organisation.service_level_measurement(id) ON DELETE RESTRICT,
  contractual_basis_reference text NOT NULL,
  finance_action_reference text NOT NULL,
  original_fare_and_ledger_preserved boolean NOT NULL DEFAULT true CHECK (original_fare_and_ledger_preserved = true),
  distinct_from_passenger_refund boolean NOT NULL DEFAULT true CHECK (distinct_from_passenger_refund = true),
  distinct_from_promotional_credit boolean NOT NULL DEFAULT true CHECK (distinct_from_promotional_credit = true),
  distinct_from_driver_adjustment boolean NOT NULL DEFAULT true CHECK (distinct_from_driver_adjustment = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(contractual_basis_reference) <> '' AND btrim(finance_action_reference) <> '')
);

DROP TRIGGER IF EXISTS service_credit_instruction_immutable ON organisation.service_credit_instruction;
CREATE TRIGGER service_credit_instruction_immutable BEFORE UPDATE OR DELETE ON organisation.service_credit_instruction
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_credit_status (
  organisation_id uuid PRIMARY KEY REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES organisation.billing_account(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN (
    'GOOD_STANDING','WATCH','CREDIT_LIMIT_REACHED','RESTRICTED_FOR_NEW_BOOKINGS','SUSPENDED_FOR_NEW_BOOKINGS'
  )),
  active_journey_restriction_allowed boolean NOT NULL DEFAULT false CHECK (active_journey_restriction_allowed = false),
  safety_or_continuity_restriction_allowed boolean NOT NULL DEFAULT false CHECK (safety_or_continuity_restriction_allowed = false),
  passenger_personal_charge_allowed boolean NOT NULL DEFAULT false CHECK (passenger_personal_charge_allowed = false),
  future_bookings_surfaced boolean NOT NULL DEFAULT false,
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organisation.organisation_credit_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN (
    'GOOD_STANDING','WATCH','CREDIT_LIMIT_REACHED','RESTRICTED_FOR_NEW_BOOKINGS','SUSPENDED_FOR_NEW_BOOKINGS'
  )),
  credit_version bigint NOT NULL CHECK (credit_version > 0),
  reason text NOT NULL,
  evidence_reference text NOT NULL,
  effective_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, credit_version),
  CHECK (btrim(reason) <> '' AND btrim(evidence_reference) <> '')
);

DROP TRIGGER IF EXISTS organisation_credit_status_event_immutable ON organisation.organisation_credit_status_event;
CREATE TRIGGER organisation_credit_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_credit_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_credit_status_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'future_bookings_surfaced' - 'state_version' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'future_bookings_surfaced' - 'state_version' - 'updated_at') THEN
    RAISE EXCEPTION 'Organisation credit protection boundaries are immutable';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Credit status update requires next version and advancing time';
  END IF;
  IF NOT (
    (OLD.status = 'GOOD_STANDING' AND NEW.status = 'WATCH')
    OR (OLD.status = 'WATCH' AND NEW.status IN ('GOOD_STANDING','CREDIT_LIMIT_REACHED'))
    OR (OLD.status = 'CREDIT_LIMIT_REACHED' AND NEW.status IN ('WATCH','RESTRICTED_FOR_NEW_BOOKINGS'))
    OR (OLD.status = 'RESTRICTED_FOR_NEW_BOOKINGS' AND NEW.status IN ('GOOD_STANDING','WATCH','SUSPENDED_FOR_NEW_BOOKINGS'))
    OR (OLD.status = 'SUSPENDED_FOR_NEW_BOOKINGS' AND NEW.status IN ('GOOD_STANDING','WATCH','RESTRICTED_FOR_NEW_BOOKINGS'))
  ) THEN RAISE EXCEPTION 'Invalid organisation credit status transition'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.organisation_credit_status_event event
     WHERE event.organisation_id = NEW.organisation_id AND event.credit_version = NEW.state_version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Credit status update requires matching evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_credit_status_update_guard ON organisation.organisation_credit_status;
CREATE CONSTRAINT TRIGGER organisation_credit_status_update_guard AFTER UPDATE ON organisation.organisation_credit_status
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organisation.guard_credit_status_update();
DROP TRIGGER IF EXISTS organisation_credit_status_delete_guard ON organisation.organisation_credit_status;
CREATE TRIGGER organisation_credit_status_delete_guard BEFORE DELETE ON organisation.organisation_credit_status
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_credit_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES organisation.billing_account(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  scope text NOT NULL,
  approved_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(reason) <> '' AND btrim(scope) <> ''),
  CHECK (valid_until > valid_from)
);

DROP TRIGGER IF EXISTS organisation_credit_override_immutable ON organisation.organisation_credit_override;
CREATE TRIGGER organisation_credit_override_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_credit_override
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.future_booking_contract_classification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES organisation.organisation_agreement(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  booking_version bigint NOT NULL CHECK (booking_version > 0),
  classification text NOT NULL CHECK (classification IN ('COVERED','RENEWAL_DEPENDENT','REAPPROVAL_REQUIRED','INVALID','MANUAL_REVIEW')),
  classified_before_pickup boolean NOT NULL CHECK (classified_before_pickup = true),
  active_journey_invalidated boolean NOT NULL DEFAULT false CHECK (active_journey_invalidated = false),
  reason_codes text[] NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, booking_id, booking_version),
  CHECK (cardinality(reason_codes) > 0)
);

DROP TRIGGER IF EXISTS future_booking_contract_classification_immutable ON organisation.future_booking_contract_classification;
CREATE TRIGGER future_booking_contract_classification_immutable BEFORE UPDATE OR DELETE ON organisation.future_booking_contract_classification
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.urgent_commercial_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  exception_type text NOT NULL CHECK (exception_type IN ('ACTIVE_JOURNEY_SAFETY','BREAKDOWN_CONTINUITY','SAFEGUARDING','SCHOOL_HANDOVER')),
  governed_authority_reference text NOT NULL,
  ordinary_commercial_approval_outstanding boolean NOT NULL,
  ordinary_commercial_approval_falsified boolean NOT NULL DEFAULT false CHECK (ordinary_commercial_approval_falsified = false),
  finance_reconciliation_required boolean NOT NULL DEFAULT true CHECK (finance_reconciliation_required = true),
  canonical_continuity_action_reference text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(governed_authority_reference) <> '' AND btrim(canonical_continuity_action_reference) <> ''),
  CHECK (ordinary_commercial_approval_outstanding = true)
);

DROP TRIGGER IF EXISTS urgent_commercial_exception_immutable ON organisation.urgent_commercial_exception;
CREATE TRIGGER urgent_commercial_exception_immutable BEFORE UPDATE OR DELETE ON organisation.urgent_commercial_exception
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_migration_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('UPLOADED','VALIDATING','VALIDATED_WITH_WARNINGS','REJECTED','READY_TO_COMMIT','COMMITTED','PARTIALLY_COMMITTED')),
  source_system text NOT NULL,
  source_of_truth_cutover_at timestamptz NOT NULL,
  dry_run_completed boolean NOT NULL DEFAULT false,
  mapping_completed boolean NOT NULL DEFAULT false,
  duplicate_check_completed boolean NOT NULL DEFAULT false,
  sensitive_data_minimised boolean NOT NULL DEFAULT true CHECK (sensitive_data_minimised = true),
  legacy_approval_flags_trusted boolean NOT NULL DEFAULT false CHECK (legacy_approval_flags_trusted = false),
  current_eligibility_revalidation_required boolean NOT NULL DEFAULT true CHECK (current_eligibility_revalidation_required = true),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  UNIQUE (organisation_id, idempotency_key),
  CHECK (btrim(source_system) <> '' AND btrim(idempotency_key) <> ''),
  CHECK (status NOT IN ('READY_TO_COMMIT','COMMITTED','PARTIALLY_COMMITTED') OR (dry_run_completed AND mapping_completed AND duplicate_check_completed))
);

CREATE OR REPLACE FUNCTION organisation.guard_organisation_migration_batch_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'dry_run_completed' - 'mapping_completed' - 'duplicate_check_completed' - 'committed_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'dry_run_completed' - 'mapping_completed' - 'duplicate_check_completed' - 'committed_at') THEN
    RAISE EXCEPTION 'Organisation migration source, cutover, minimisation and eligibility controls are immutable';
  END IF;
  IF (OLD.dry_run_completed AND NOT NEW.dry_run_completed)
     OR (OLD.mapping_completed AND NOT NEW.mapping_completed)
     OR (OLD.duplicate_check_completed AND NOT NEW.duplicate_check_completed) THEN
    RAISE EXCEPTION 'Organisation migration validation evidence cannot regress';
  END IF;
  IF NOT (
    (OLD.status = 'UPLOADED' AND NEW.status IN ('VALIDATING','REJECTED'))
    OR (OLD.status = 'VALIDATING' AND NEW.status IN ('VALIDATED_WITH_WARNINGS','REJECTED','READY_TO_COMMIT'))
    OR (OLD.status = 'VALIDATED_WITH_WARNINGS' AND NEW.status IN ('REJECTED','READY_TO_COMMIT'))
    OR (OLD.status = 'READY_TO_COMMIT' AND NEW.status IN ('COMMITTED','PARTIALLY_COMMITTED','REJECTED'))
  ) THEN RAISE EXCEPTION 'Invalid organisation migration batch transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_migration_batch_update_guard ON organisation.organisation_migration_batch;
CREATE TRIGGER organisation_migration_batch_update_guard BEFORE UPDATE ON organisation.organisation_migration_batch
FOR EACH ROW EXECUTE FUNCTION organisation.guard_organisation_migration_batch_update();
DROP TRIGGER IF EXISTS organisation_migration_batch_delete_guard ON organisation.organisation_migration_batch;
CREATE TRIGGER organisation_migration_batch_delete_guard BEFORE DELETE ON organisation.organisation_migration_batch
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_migration_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES organisation.organisation_migration_batch(id) ON DELETE RESTRICT,
  row_number integer NOT NULL CHECK (row_number > 0),
  entity_type text NOT NULL CHECK (entity_type IN ('SITE','USER','COST_CENTRE','ROSTER','TEMPLATE','FUTURE_SCHEDULE')),
  outcome text NOT NULL CHECK (outcome IN ('VALID','WARNING','REJECTED','DUPLICATE','COMMITTED')),
  reason_codes text[] NOT NULL,
  current_eligibility_revalidated boolean NOT NULL DEFAULT false,
  legacy_approved_driver_bypass_used boolean NOT NULL DEFAULT false CHECK (legacy_approved_driver_bypass_used = false),
  legacy_safe_passenger_bypass_used boolean NOT NULL DEFAULT false CHECK (legacy_safe_passenger_bypass_used = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number),
  CHECK (cardinality(reason_codes) > 0),
  CHECK (entity_type NOT IN ('ROSTER','TEMPLATE','FUTURE_SCHEDULE') OR current_eligibility_revalidated)
);

DROP TRIGGER IF EXISTS organisation_migration_row_immutable ON organisation.organisation_migration_row;
CREATE TRIGGER organisation_migration_row_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_migration_row
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_reinstatement_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_revalidated boolean NOT NULL,
  credit_revalidated boolean NOT NULL,
  security_revalidated boolean NOT NULL,
  documents_revalidated boolean NOT NULL,
  api_credentials_revalidated boolean NOT NULL,
  contacts_revalidated boolean NOT NULL,
  old_api_credentials_blindly_restored boolean NOT NULL DEFAULT false CHECK (old_api_credentials_blindly_restored = false),
  outcome text NOT NULL CHECK (outcome IN ('PASS','REVIEW_REQUIRED','FAIL')),
  evidence_references text[] NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(evidence_references) > 0),
  CHECK (outcome <> 'PASS' OR (agreement_revalidated AND credit_revalidated AND security_revalidated
    AND documents_revalidated AND api_credentials_revalidated AND contacts_revalidated))
);

DROP TRIGGER IF EXISTS organisation_reinstatement_assessment_immutable ON organisation.organisation_reinstatement_assessment;
CREATE TRIGGER organisation_reinstatement_assessment_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_reinstatement_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_commercial_acceptance_case_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_number integer NOT NULL CHECK (scenario_number BETWEEN 53 AND 71),
  scenario_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  fixture_reference text NOT NULL,
  canonical_engines_preserved boolean NOT NULL DEFAULT true CHECK (canonical_engines_preserved = true),
  hard_protection_precedence_preserved boolean NOT NULL DEFAULT true CHECK (hard_protection_precedence_preserved = true),
  passenger_personal_liability_created boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_created = false),
  external_execution_allowed boolean NOT NULL DEFAULT false CHECK (external_execution_allowed = false),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_key, version),
  UNIQUE (scenario_number, version),
  CHECK (btrim(scenario_key) <> '' AND btrim(fixture_reference) <> '')
);

DROP TRIGGER IF EXISTS organisation_commercial_acceptance_case_immutable ON organisation.organisation_commercial_acceptance_case_version;
CREATE TRIGGER organisation_commercial_acceptance_case_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_commercial_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_commercial_command_deduplication (
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

DROP TRIGGER IF EXISTS organisation_commercial_command_dedup_immutable ON organisation.organisation_commercial_command_deduplication;
CREATE TRIGGER organisation_commercial_command_dedup_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_commercial_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_commercial_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL CHECK (event_type IN (
    'OrganisationAgreementActivated.v1','OrganisationAgreementExpiring.v1','OrganisationAgreementExpired.v1',
    'OrganisationPolicyChanged.v1','OrganisationPolicySimulationCompleted.v1','BookingApprovalRequested.v1',
    'BookingApprovalGranted.v1','BookingApprovalRejected.v1','OrganisationCreditStatusChanged.v1',
    'OrganisationRestrictionApplied.v1','OrganisationRestrictionLifted.v1','OrganisationServiceLevelMissed.v1',
    'OrganisationCorrectiveActionOpened.v1','OrganisationAPIClientCreated.v1',
    'OrganisationWebhookDeliveryFailed.v1','OrganisationAgreementTerminated.v1'
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

DROP TRIGGER IF EXISTS organisation_commercial_event_immutable ON organisation.organisation_commercial_event;
CREATE TRIGGER organisation_commercial_event_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_commercial_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_commercial_outbox_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES organisation.organisation_commercial_event(id) ON DELETE RESTRICT,
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

CREATE OR REPLACE FUNCTION organisation.guard_commercial_outbox_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.event_id IS DISTINCT FROM NEW.event_id
     OR OLD.topic IS DISTINCT FROM NEW.topic OR OLD.event_type IS DISTINCT FROM NEW.event_type
     OR OLD.payload IS DISTINCT FROM NEW.payload OR OLD.occurred_at IS DISTINCT FROM NEW.occurred_at
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Organisation commercial outbox envelope is immutable';
  END IF;
  IF NEW.attempt_count < OLD.attempt_count OR (OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at) THEN
    RAISE EXCEPTION 'Invalid organisation commercial outbox delivery transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_commercial_outbox_update_guard ON organisation.organisation_commercial_outbox_message;
CREATE TRIGGER organisation_commercial_outbox_update_guard BEFORE UPDATE ON organisation.organisation_commercial_outbox_message
FOR EACH ROW EXECUTE FUNCTION organisation.guard_commercial_outbox_update();
DROP TRIGGER IF EXISTS organisation_commercial_outbox_delete_guard ON organisation.organisation_commercial_outbox_message;
CREATE TRIGGER organisation_commercial_outbox_delete_guard BEFORE DELETE ON organisation.organisation_commercial_outbox_message
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
