-- DAZAT Mobility — Engineering Phase 0.17
-- Business, Organisation, School & Authority Account Operations Engine Part 1.
-- Organisation identity, tenancy, roles, booking authority, agreements, approvals,
-- integrations, exports, restrictions and offboarding. No staff or external execution is enabled.

CREATE TABLE IF NOT EXISTS organisation.organisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_type text NOT NULL CHECK (organisation_type IN (
    'BUSINESS','SCHOOL_EDUCATION','LOCAL_AUTHORITY_PUBLIC_BODY','HOSPITAL_HEALTHCARE',
    'CARE_ORGANISATION','CHARITY_COMMUNITY','PARTNER_OPERATOR'
  )),
  display_name text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'PROSPECT','APPLICATION_DUE_DILIGENCE','COMMERCIAL_SERVICE_REVIEW','CONTRACT_PENDING',
    'CONFIGURATION','ACTIVE','RESTRICTED','SUSPENDED','OFFBOARDING','CLOSED'
  )),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  legal_status_inferred boolean NOT NULL DEFAULT false CHECK (legal_status_inferred = false),
  public_body_power_inferred boolean NOT NULL DEFAULT false CHECK (public_body_power_inferred = false),
  safeguarding_authority_inferred boolean NOT NULL DEFAULT false CHECK (safeguarding_authority_inferred = false),
  tax_treatment_inferred boolean NOT NULL DEFAULT false CHECK (tax_treatment_inferred = false),
  passenger_identity_ownership_claimed boolean NOT NULL DEFAULT false CHECK (passenger_identity_ownership_claimed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(display_name) <> '')
);

CREATE TABLE IF NOT EXISTS organisation.organisation_lifecycle_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  from_state text,
  to_state text NOT NULL CHECK (to_state IN (
    'PROSPECT','APPLICATION_DUE_DILIGENCE','COMMERCIAL_SERVICE_REVIEW','CONTRACT_PENDING',
    'CONFIGURATION','ACTIVE','RESTRICTED','SUSPENDED','OFFBOARDING','CLOSED'
  )),
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  actor_type text NOT NULL,
  decision_reason text NOT NULL,
  approval_evidence_reference text,
  effective_at timestamptz NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, aggregate_version),
  CHECK (btrim(actor_type) <> '' AND btrim(decision_reason) <> ''),
  CHECK (to_state NOT IN ('ACTIVE','RESTRICTED','SUSPENDED','CLOSED') OR approval_evidence_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS organisation_lifecycle_transition_immutable ON organisation.organisation_lifecycle_transition;
CREATE TRIGGER organisation_lifecycle_transition_immutable
BEFORE UPDATE OR DELETE ON organisation.organisation_lifecycle_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_organisation_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_type IS DISTINCT FROM NEW.organisation_type
     OR OLD.display_name IS DISTINCT FROM NEW.display_name
     OR OLD.legal_status_inferred IS DISTINCT FROM NEW.legal_status_inferred
     OR OLD.public_body_power_inferred IS DISTINCT FROM NEW.public_body_power_inferred
     OR OLD.safeguarding_authority_inferred IS DISTINCT FROM NEW.safeguarding_authority_inferred
     OR OLD.tax_treatment_inferred IS DISTINCT FROM NEW.tax_treatment_inferred
     OR OLD.passenger_identity_ownership_claimed IS DISTINCT FROM NEW.passenger_identity_ownership_claimed
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Organisation identity truth is immutable; use a versioned profile';
  END IF;
  IF NEW.state_version <> OLD.state_version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Organisation state update requires the next version and advancing time';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.organisation_lifecycle_transition transition
     WHERE transition.organisation_id = NEW.id
       AND transition.aggregate_version = NEW.state_version
       AND transition.from_state = OLD.state
       AND transition.to_state = NEW.state
  ) THEN RAISE EXCEPTION 'Organisation state update requires matching lifecycle evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_update_guard ON organisation.organisation;
CREATE CONSTRAINT TRIGGER organisation_update_guard
AFTER UPDATE ON organisation.organisation
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION organisation.guard_organisation_update();
DROP TRIGGER IF EXISTS organisation_delete_guard ON organisation.organisation;
CREATE TRIGGER organisation_delete_guard
BEFORE DELETE ON organisation.organisation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_version_close_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'effective_to') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'effective_to') THEN
    RAISE EXCEPTION 'Versioned organisation policy content is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('SUPERSEDED','REVOKED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'Versioned organisation policy only permits one ACTIVE close transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS organisation.organisation_legal_profile_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  legal_name text NOT NULL,
  trading_name text,
  principal_address jsonb NOT NULL,
  jurisdiction_code text NOT NULL,
  organisation_identifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_tax_identifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  authorised_signatory_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  contract_references text[] NOT NULL DEFAULT ARRAY[]::text[],
  provenance_reference text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, version),
  CHECK (btrim(legal_name) <> '' AND btrim(jurisdiction_code) <> '' AND btrim(provenance_reference) <> ''),
  CHECK (jsonb_typeof(principal_address) = 'object'),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_legal_profile
  ON organisation.organisation_legal_profile_version (organisation_id) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_legal_profile_update_guard ON organisation.organisation_legal_profile_version;
CREATE TRIGGER organisation_legal_profile_update_guard BEFORE UPDATE ON organisation.organisation_legal_profile_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_legal_profile_delete_guard ON organisation.organisation_legal_profile_version;
CREATE TRIGGER organisation_legal_profile_delete_guard BEFORE DELETE ON organisation.organisation_legal_profile_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_site (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  site_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  site_type text NOT NULL CHECK (site_type IN ('SITE','BRANCH','SCHOOL','HOSPITAL','DEPARTMENT','OTHER')),
  name text NOT NULL,
  operational_address jsonb,
  separate_legal_entity boolean NOT NULL DEFAULT false,
  linked_legal_organisation_id uuid REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  operational_state text NOT NULL CHECK (operational_state IN ('ACTIVE','RESTRICTED','CLOSED')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, site_key, version),
  CHECK (btrim(site_key) <> '' AND btrim(name) <> ''),
  CHECK (NOT separate_legal_entity OR linked_legal_organisation_id IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_site
  ON organisation.organisation_site (organisation_id, site_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_site_update_guard ON organisation.organisation_site;
CREATE TRIGGER organisation_site_update_guard BEFORE UPDATE ON organisation.organisation_site
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_site_delete_guard ON organisation.organisation_site;
CREATE TRIGGER organisation_site_delete_guard BEFORE DELETE ON organisation.organisation_site
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.cost_centre_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  cost_centre_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  name text NOT NULL,
  site_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  permitted_role_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  reporting_code text,
  finance_ledger boolean NOT NULL DEFAULT false CHECK (finance_ledger = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, cost_centre_key, version),
  CHECK (btrim(cost_centre_key) <> '' AND btrim(name) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_cost_centre_version
  ON organisation.cost_centre_version (organisation_id, cost_centre_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS cost_centre_version_update_guard ON organisation.cost_centre_version;
CREATE TRIGGER cost_centre_version_update_guard BEFORE UPDATE ON organisation.cost_centre_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS cost_centre_version_delete_guard ON organisation.cost_centre_version;
CREATE TRIGGER cost_centre_version_delete_guard BEFORE DELETE ON organisation.cost_centre_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_contact_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  contact_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  purpose text NOT NULL CHECK (purpose IN (
    'OPERATIONS','FINANCE','CONTRACT','SAFEGUARDING','EMERGENCY_ESCALATION','DATA_PROTECTION','TECHNICAL_API'
  )),
  person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  role_description text NOT NULL,
  contact_point_reference text NOT NULL,
  authority_evidence_reference text NOT NULL,
  finance_authority_inferred_as_safeguarding boolean NOT NULL DEFAULT false CHECK (finance_authority_inferred_as_safeguarding = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, contact_key, version),
  CHECK (btrim(contact_key) <> '' AND btrim(role_description) <> ''),
  CHECK (btrim(contact_point_reference) <> '' AND btrim(authority_evidence_reference) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_contact
  ON organisation.organisation_contact_version (organisation_id, contact_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_contact_version_update_guard ON organisation.organisation_contact_version;
CREATE TRIGGER organisation_contact_version_update_guard BEFORE UPDATE ON organisation.organisation_contact_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_contact_version_delete_guard ON organisation.organisation_contact_version;
CREATE TRIGGER organisation_contact_version_delete_guard BEFORE DELETE ON organisation.organisation_contact_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  role_key text NOT NULL,
  role_family text NOT NULL CHECK (role_family IN (
    'ORGANISATION_OWNER_PRIMARY_ADMIN','TRANSPORT_COORDINATOR','BOOKER','FINANCE',
    'SCHOOL_TRANSPORT_COORDINATOR','SAFEGUARDING_LEAD','SERVICE_MANAGER',
    'READ_ONLY_AUDITOR','API_SERVICE_ACCOUNT'
  )),
  display_name text NOT NULL,
  universal_admin boolean NOT NULL DEFAULT false CHECK (universal_admin = false),
  status text NOT NULL CHECK (status IN ('ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, role_key),
  CHECK (btrim(role_key) <> '' AND btrim(display_name) <> '')
);

CREATE OR REPLACE FUNCTION organisation.guard_role_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status') IS DISTINCT FROM (to_jsonb(NEW) - 'status') THEN
    RAISE EXCEPTION 'Organisation role content is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status <> 'RETIRED' THEN
    RAISE EXCEPTION 'Organisation role only permits ACTIVE to RETIRED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_role_update_guard ON organisation.organisation_role;
CREATE TRIGGER organisation_role_update_guard BEFORE UPDATE ON organisation.organisation_role
FOR EACH ROW EXECUTE FUNCTION organisation.guard_role_update();
DROP TRIGGER IF EXISTS organisation_role_delete_guard ON organisation.organisation_role;
CREATE TRIGGER organisation_role_delete_guard BEFORE DELETE ON organisation.organisation_role
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_user_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN (
    'INVITED','ACTIVE','TEMPORARILY_RESTRICTED','SUSPENDED','EXPIRED','REVOKED','LEFT_ORGANISATION'
  )),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  site_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  cost_centre_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  service_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  passenger_group_refs text[] NOT NULL DEFAULT ARRAY[]::text[],
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, person_id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE IF NOT EXISTS organisation.organisation_membership_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  membership_version bigint NOT NULL CHECK (membership_version > 0),
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  incompatible_sessions_revoked boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, membership_version),
  CHECK (btrim(reason) <> '')
);

DROP TRIGGER IF EXISTS organisation_membership_status_event_immutable ON organisation.organisation_membership_status_event;
CREATE TRIGGER organisation_membership_status_event_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_membership_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION organisation.guard_membership_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.person_id IS DISTINCT FROM NEW.person_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Organisation membership identity is immutable';
  END IF;
  IF NEW.version <> OLD.version + 1 OR NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Membership update requires next version and advancing time';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organisation.organisation_membership_status_event event
     WHERE event.membership_id = NEW.id AND event.membership_version = NEW.version
       AND event.from_status = OLD.status AND event.to_status = NEW.status
  ) THEN RAISE EXCEPTION 'Membership update requires matching status evidence'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_membership_update_guard ON organisation.organisation_user_membership;
CREATE CONSTRAINT TRIGGER organisation_membership_update_guard
AFTER UPDATE ON organisation.organisation_user_membership DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION organisation.guard_membership_update();
DROP TRIGGER IF EXISTS organisation_membership_delete_guard ON organisation.organisation_user_membership;
CREATE TRIGGER organisation_membership_delete_guard BEFORE DELETE ON organisation.organisation_user_membership
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_permission_grant_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES organisation.organisation_role(id) ON DELETE RESTRICT,
  grant_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  permission text NOT NULL CHECK (permission IN (
    'BOOKING.CREATE','BOOKING.CANCEL','BOOKING.CHANGE','PASSENGER.ROSTER_VIEW',
    'PASSENGER.ROSTER_EDIT','SCHOOL.HANDOVER_VIEW','SCHOOL.HANDOVER_MANAGE',
    'FINANCE.INVOICE_VIEW','FINANCE.COST_CENTRE_MANAGE','REPORTING.EXPORT',
    'USER.INVITE','USER.ROLE_MANAGE','ORG.SETTINGS_MANAGE'
  )),
  site_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  cost_centre_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  service_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  passenger_group_refs text[] NOT NULL DEFAULT ARRAY[]::text[],
  region_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  school_safeguarding_scope_explicit boolean NOT NULL DEFAULT false,
  granted_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, grant_key, version),
  CHECK (btrim(grant_key) <> '' AND btrim(evidence_reference) <> ''),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (permission NOT IN ('SCHOOL.HANDOVER_VIEW','SCHOOL.HANDOVER_MANAGE') OR school_safeguarding_scope_explicit),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_permission_grant
  ON organisation.organisation_permission_grant_version (organisation_id, grant_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_permission_grant_update_guard ON organisation.organisation_permission_grant_version;
CREATE TRIGGER organisation_permission_grant_update_guard BEFORE UPDATE ON organisation.organisation_permission_grant_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_permission_grant_delete_guard ON organisation.organisation_permission_grant_version;
CREATE TRIGGER organisation_permission_grant_delete_guard BEFORE DELETE ON organisation.organisation_permission_grant_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  intended_contact_hash char(64) NOT NULL CHECK (intended_contact_hash ~ '^[0-9a-f]{64}$'),
  invitation_secret_hash char(64) NOT NULL UNIQUE CHECK (invitation_secret_hash ~ '^[0-9a-f]{64}$'),
  proposed_role_ids uuid[] NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('ISSUED','ACCEPTED','EXPIRED','REVOKED')),
  expires_at timestamptz NOT NULL,
  accepted_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  intended_recipient_matched boolean,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(proposed_role_ids) > 0 AND btrim(purpose) <> ''),
  CHECK (expires_at > created_at),
  CHECK (status <> 'ACCEPTED' OR (accepted_by_person_id IS NOT NULL AND intended_recipient_matched AND accepted_at IS NOT NULL))
);

CREATE OR REPLACE FUNCTION organisation.guard_invitation_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.intended_contact_hash IS DISTINCT FROM NEW.intended_contact_hash
     OR OLD.invitation_secret_hash IS DISTINCT FROM NEW.invitation_secret_hash
     OR OLD.proposed_role_ids IS DISTINCT FROM NEW.proposed_role_ids
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Organisation invitation authority is immutable';
  END IF;
  IF OLD.status <> 'ISSUED' OR NEW.status NOT IN ('ACCEPTED','EXPIRED','REVOKED') THEN
    RAISE EXCEPTION 'Invalid organisation invitation transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_invitation_update_guard ON organisation.organisation_invitation;
CREATE TRIGGER organisation_invitation_update_guard BEFORE UPDATE ON organisation.organisation_invitation
FOR EACH ROW EXECUTE FUNCTION organisation.guard_invitation_update();

DROP TRIGGER IF EXISTS organisation_invitation_delete_guard ON organisation.organisation_invitation;
CREATE TRIGGER organisation_invitation_delete_guard BEFORE DELETE ON organisation.organisation_invitation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_restriction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN (
    'NEW_BOOKINGS','SPECIFIC_SERVICE','SPECIFIC_SITE','CREDIT_BOOKINGS','API_ACCESS','EXPORTS','ADMIN_CHANGES'
  )),
  service_type text,
  site_id uuid REFERENCES organisation.organisation_site(id) ON DELETE RESTRICT,
  reason_class text NOT NULL CHECK (reason_class IN (
    'COMMERCIAL','CREDIT','SECURITY','COMPLIANCE','CONTRACT_EXPIRY','INVESTIGATION'
  )),
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','LIFTED','EXPIRED')),
  actor_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  evidence_reference text NOT NULL,
  active_journey_termination_allowed boolean NOT NULL DEFAULT false CHECK (active_journey_termination_allowed = false),
  creates_passenger_or_driver_finding boolean NOT NULL DEFAULT false CHECK (creates_passenger_or_driver_finding = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(reason) <> '' AND btrim(evidence_reference) <> ''),
  CHECK (scope <> 'SPECIFIC_SERVICE' OR service_type IS NOT NULL),
  CHECK (scope <> 'SPECIFIC_SITE' OR site_id IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE OR REPLACE FUNCTION organisation.guard_restriction_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'effective_to') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'effective_to') THEN
    RAISE EXCEPTION 'Organisation restriction scope and evidence are immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('LIFTED','EXPIRED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'Organisation restriction only permits one evidenced close transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_restriction_update_guard ON organisation.organisation_restriction;
CREATE TRIGGER organisation_restriction_update_guard BEFORE UPDATE ON organisation.organisation_restriction
FOR EACH ROW EXECUTE FUNCTION organisation.guard_restriction_update();

DROP TRIGGER IF EXISTS organisation_restriction_delete_guard ON organisation.organisation_restriction;
CREATE TRIGGER organisation_restriction_delete_guard BEFORE DELETE ON organisation.organisation_restriction
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_service_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  service_types text[] NOT NULL,
  booking_window_rule jsonb NOT NULL,
  approval_policy_key text,
  cost_centre_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  pickup_region_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  scheduled_booking_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  accessibility_requirements_preserved boolean NOT NULL DEFAULT true CHECK (accessibility_requirements_preserved = true),
  universal_safety_functions_preserved boolean NOT NULL DEFAULT true CHECK (universal_safety_functions_preserved = true),
  school_safeguarding_rules_preserved boolean NOT NULL DEFAULT true CHECK (school_safeguarding_rules_preserved = true),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, policy_key, version),
  CHECK (cardinality(service_types) > 0 AND btrim(policy_key) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_service_policy
  ON organisation.organisation_service_policy_version (organisation_id, policy_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_service_policy_update_guard ON organisation.organisation_service_policy_version;
CREATE TRIGGER organisation_service_policy_update_guard BEFORE UPDATE ON organisation.organisation_service_policy_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_service_policy_delete_guard ON organisation.organisation_service_policy_version;
CREATE TRIGGER organisation_service_policy_delete_guard BEFORE DELETE ON organisation.organisation_service_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_agreement_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  agreement_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  service_scope jsonb NOT NULL,
  region_codes text[] NOT NULL,
  service_level_policy jsonb NOT NULL,
  reporting_commitments jsonb NOT NULL,
  escalation_contact_keys text[] NOT NULL,
  linked_financial_agreement_reference text NOT NULL,
  unvalidated_guaranteed_claim_present boolean NOT NULL DEFAULT false CHECK (unvalidated_guaranteed_claim_present = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, agreement_key, version),
  CHECK (btrim(agreement_key) <> '' AND btrim(linked_financial_agreement_reference) <> ''),
  CHECK (cardinality(region_codes) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_agreement
  ON organisation.organisation_agreement_version (organisation_id, agreement_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_agreement_update_guard ON organisation.organisation_agreement_version;
CREATE TRIGGER organisation_agreement_update_guard BEFORE UPDATE ON organisation.organisation_agreement_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_agreement_delete_guard ON organisation.organisation_agreement_version;
CREATE TRIGGER organisation_agreement_delete_guard BEFORE DELETE ON organisation.organisation_agreement_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_communication_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  purpose text NOT NULL,
  authorised_contact_purposes text[] NOT NULL,
  portal_required_for_sensitive_content boolean NOT NULL DEFAULT true,
  sms_email_sensitive_data_minimised boolean NOT NULL DEFAULT true CHECK (sms_email_sensitive_data_minimised = true),
  communications_policy_reference text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, policy_key, version),
  CHECK (btrim(policy_key) <> '' AND btrim(purpose) <> '' AND btrim(communications_policy_reference) <> ''),
  CHECK (cardinality(authorised_contact_purposes) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_communication_policy
  ON organisation.organisation_communication_policy_version (organisation_id, policy_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_communication_policy_update_guard ON organisation.organisation_communication_policy_version;
CREATE TRIGGER organisation_communication_policy_update_guard BEFORE UPDATE ON organisation.organisation_communication_policy_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_communication_policy_delete_guard ON organisation.organisation_communication_policy_version;
CREATE TRIGGER organisation_communication_policy_delete_guard BEFORE DELETE ON organisation.organisation_communication_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_passenger_roster_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  managed_passenger_reference text,
  passenger_group_ref text NOT NULL,
  authority_basis_reference text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','REMOVED','EXPIRED')),
  organisation_owns_passenger_identity boolean NOT NULL DEFAULT false CHECK (organisation_owns_passenger_identity = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((person_id IS NOT NULL) <> (managed_passenger_reference IS NOT NULL)),
  CHECK (btrim(passenger_group_ref) <> '' AND btrim(authority_basis_reference) <> '' AND btrim(purpose) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_person_roster_entry
  ON organisation.organisation_passenger_roster_entry (organisation_id, person_id, passenger_group_ref)
  WHERE status = 'ACTIVE' AND person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_managed_passenger_roster_entry
  ON organisation.organisation_passenger_roster_entry (organisation_id, managed_passenger_reference, passenger_group_ref)
  WHERE status = 'ACTIVE' AND managed_passenger_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION organisation.guard_passenger_roster_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'effective_to') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'effective_to') THEN
    RAISE EXCEPTION 'Organisation passenger roster authority and purpose are immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('SUSPENDED','REMOVED','EXPIRED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'Organisation passenger roster only permits one evidenced close transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_passenger_roster_entry_update_guard ON organisation.organisation_passenger_roster_entry;
CREATE TRIGGER organisation_passenger_roster_entry_update_guard BEFORE UPDATE ON organisation.organisation_passenger_roster_entry
FOR EACH ROW EXECUTE FUNCTION organisation.guard_passenger_roster_update();
DROP TRIGGER IF EXISTS organisation_passenger_roster_entry_delete_guard ON organisation.organisation_passenger_roster_entry;
CREATE TRIGGER organisation_passenger_roster_entry_delete_guard BEFORE DELETE ON organisation.organisation_passenger_roster_entry
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.booking_authority_rule_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  rule_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  role_ids uuid[] NOT NULL,
  service_types text[] NOT NULL,
  passenger_group_refs text[] NOT NULL,
  contract_keys text[] NOT NULL,
  cost_centre_keys text[] NOT NULL,
  region_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  membership_alone_is_booking_authority boolean NOT NULL DEFAULT false CHECK (membership_alone_is_booking_authority = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, rule_key, version),
  CHECK (btrim(rule_key) <> '' AND cardinality(role_ids) > 0),
  CHECK (cardinality(service_types) > 0 AND cardinality(passenger_group_refs) > 0),
  CHECK (cardinality(contract_keys) > 0 AND cardinality(cost_centre_keys) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_authority_rule
  ON organisation.booking_authority_rule_version (organisation_id, rule_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS booking_authority_rule_update_guard ON organisation.booking_authority_rule_version;
CREATE TRIGGER booking_authority_rule_update_guard BEFORE UPDATE ON organisation.booking_authority_rule_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS booking_authority_rule_delete_guard ON organisation.booking_authority_rule_version;
CREATE TRIGGER booking_authority_rule_delete_guard BEFORE DELETE ON organisation.booking_authority_rule_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.booking_funding_instruction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  funding_source_type text NOT NULL CHECK (funding_source_type IN (
    'ORGANISATION','LOCAL_AUTHORITY','PASSENGER','MIXED','OTHER_APPROVED'
  )),
  cost_centre_key text,
  purchase_order_reference text,
  case_reference text,
  transport_authorisation_reference text,
  project_code text,
  format_validated boolean NOT NULL,
  external_legal_or_financial_validity_invented boolean NOT NULL DEFAULT false CHECK (external_legal_or_financial_validity_invented = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, booking_id)
);

DROP TRIGGER IF EXISTS booking_funding_instruction_immutable ON organisation.booking_funding_instruction;
CREATE TRIGGER booking_funding_instruction_immutable BEFORE UPDATE OR DELETE ON organisation.booking_funding_instruction
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_approval_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  trigger_conditions jsonb NOT NULL,
  approver_role_ids uuid[] NOT NULL,
  expiry_seconds integer NOT NULL CHECK (expiry_seconds > 0),
  safety_driven_active_journey_change_exempt boolean NOT NULL DEFAULT true CHECK (safety_driven_active_journey_change_exempt = true),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, policy_key, version),
  CHECK (btrim(policy_key) <> '' AND cardinality(approver_role_ids) > 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_approval_policy
  ON organisation.organisation_approval_policy_version (organisation_id, policy_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_approval_policy_update_guard ON organisation.organisation_approval_policy_version;
CREATE TRIGGER organisation_approval_policy_update_guard BEFORE UPDATE ON organisation.organisation_approval_policy_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_approval_policy_delete_guard ON organisation.organisation_approval_policy_version;
CREATE TRIGGER organisation_approval_policy_delete_guard BEFORE DELETE ON organisation.organisation_approval_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_approval_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  approval_policy_version_id uuid NOT NULL REFERENCES organisation.organisation_approval_policy_version(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  proposed_booking_version bigint NOT NULL CHECK (proposed_booking_version > 0),
  quote_id uuid,
  proposed_quote_version bigint CHECK (proposed_quote_version IS NULL OR proposed_quote_version > 0),
  status text NOT NULL CHECK (status IN ('NOT_REQUIRED','PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED')),
  requested_by_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  decided_by_membership_id uuid REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  decision_evidence_reference text,
  material_change_requires_reapproval boolean NOT NULL DEFAULT true CHECK (material_change_requires_reapproval = true),
  edits_finance_ledger boolean NOT NULL DEFAULT false CHECK (edits_finance_ledger = false),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > requested_at),
  CHECK (status NOT IN ('APPROVED','REJECTED') OR (decided_by_membership_id IS NOT NULL AND decision_evidence_reference IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE OR REPLACE FUNCTION organisation.guard_approval_request_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.approval_policy_version_id IS DISTINCT FROM NEW.approval_policy_version_id
     OR OLD.booking_id IS DISTINCT FROM NEW.booking_id
     OR OLD.proposed_booking_version IS DISTINCT FROM NEW.proposed_booking_version
     OR OLD.quote_id IS DISTINCT FROM NEW.quote_id
     OR OLD.proposed_quote_version IS DISTINCT FROM NEW.proposed_quote_version
     OR OLD.requested_by_membership_id IS DISTINCT FROM NEW.requested_by_membership_id
     OR OLD.material_change_requires_reapproval IS DISTINCT FROM NEW.material_change_requires_reapproval
     OR OLD.edits_finance_ledger IS DISTINCT FROM NEW.edits_finance_ledger
     OR OLD.requested_at IS DISTINCT FROM NEW.requested_at
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION 'Organisation approval request scope and proposed versions are immutable';
  END IF;
  IF OLD.status NOT IN ('NOT_REQUIRED','PENDING') OR NEW.status NOT IN ('APPROVED','REJECTED','EXPIRED','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid organisation approval transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_approval_request_update_guard ON organisation.organisation_approval_request;
CREATE TRIGGER organisation_approval_request_update_guard BEFORE UPDATE ON organisation.organisation_approval_request
FOR EACH ROW EXECUTE FUNCTION organisation.guard_approval_request_update();

DROP TRIGGER IF EXISTS organisation_approval_request_delete_guard ON organisation.organisation_approval_request;
CREATE TRIGGER organisation_approval_request_delete_guard BEFORE DELETE ON organisation.organisation_approval_request
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_support_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','WAITING_ORGANISATION','WAITING_INTERNAL','RESOLVED','CLOSED')),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  next_action text NOT NULL,
  attention_at timestamptz NOT NULL,
  linked_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  linked_journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  linked_invoice_reference text,
  linked_contract_key text,
  linked_canonical_case_type text,
  linked_canonical_case_id uuid,
  replaces_safety_safeguarding_finance_case boolean NOT NULL DEFAULT false CHECK (replaces_safety_safeguarding_finance_case = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(next_action) <> ''),
  CHECK (priority NOT IN ('P0','P1') OR owner_person_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION organisation.guard_support_case_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.organisation_id IS DISTINCT FROM NEW.organisation_id
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.linked_booking_id IS DISTINCT FROM NEW.linked_booking_id
     OR OLD.linked_journey_id IS DISTINCT FROM NEW.linked_journey_id
     OR OLD.linked_invoice_reference IS DISTINCT FROM NEW.linked_invoice_reference
     OR OLD.linked_contract_key IS DISTINCT FROM NEW.linked_contract_key
     OR OLD.linked_canonical_case_type IS DISTINCT FROM NEW.linked_canonical_case_type
     OR OLD.linked_canonical_case_id IS DISTINCT FROM NEW.linked_canonical_case_id
     OR OLD.replaces_safety_safeguarding_finance_case IS DISTINCT FROM NEW.replaces_safety_safeguarding_finance_case
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Organisation support case links and priority are immutable';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN RAISE EXCEPTION 'Organisation support case updated_at must advance'; END IF;
  IF NEW.priority IN ('P0','P1') AND NEW.owner_person_id IS NULL THEN
    RAISE EXCEPTION 'Critical organisation support case cannot remain unowned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_support_case_update_guard ON organisation.organisation_support_case;
CREATE TRIGGER organisation_support_case_update_guard BEFORE UPDATE ON organisation.organisation_support_case
FOR EACH ROW EXECUTE FUNCTION organisation.guard_support_case_update();
DROP TRIGGER IF EXISTS organisation_support_case_delete_guard ON organisation.organisation_support_case;
CREATE TRIGGER organisation_support_case_delete_guard BEFORE DELETE ON organisation.organisation_support_case
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_api_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  client_name text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('DEVELOPMENT','TEST','STAGING','PRODUCTION')),
  status text NOT NULL CHECK (status IN ('PENDING_APPROVAL','ACTIVE','SUSPENDED','REVOKED')),
  permissions text[] NOT NULL,
  site_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  cost_centre_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  human_permissions_inherited boolean NOT NULL DEFAULT false CHECK (human_permissions_inherited = false),
  booking_id_knowledge_grants_authority boolean NOT NULL DEFAULT false CHECK (booking_id_knowledge_grants_authority = false),
  external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(client_name) <> '' AND cardinality(permissions) > 0)
);

CREATE OR REPLACE FUNCTION organisation.guard_api_client_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status') IS DISTINCT FROM (to_jsonb(NEW) - 'status') THEN
    RAISE EXCEPTION 'Organisation API client tenancy, environment and permission scope are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'PENDING_APPROVAL' AND NEW.status IN ('ACTIVE','REVOKED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('SUSPENDED','REVOKED'))
    OR (OLD.status = 'SUSPENDED' AND NEW.status IN ('ACTIVE','REVOKED'))
  ) THEN RAISE EXCEPTION 'Invalid Organisation API client transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_api_client_update_guard ON organisation.organisation_api_client;
CREATE TRIGGER organisation_api_client_update_guard BEFORE UPDATE ON organisation.organisation_api_client
FOR EACH ROW EXECUTE FUNCTION organisation.guard_api_client_update();
DROP TRIGGER IF EXISTS organisation_api_client_delete_guard ON organisation.organisation_api_client;
CREATE TRIGGER organisation_api_client_delete_guard BEFORE DELETE ON organisation.organisation_api_client
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_api_credential_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  api_client_id uuid NOT NULL REFERENCES organisation.organisation_api_client(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','ROTATED','REVOKED','EXPIRED')),
  credential_hash char(64) NOT NULL UNIQUE CHECK (credential_hash ~ '^[0-9a-f]{64}$'),
  key_identifier text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  rotated_from_credential_id uuid REFERENCES organisation.organisation_api_credential_version(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_client_id, version),
  CHECK (valid_until > valid_from AND btrim(key_identifier) <> '')
);

CREATE OR REPLACE FUNCTION organisation.guard_api_credential_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status') IS DISTINCT FROM (to_jsonb(NEW) - 'status') THEN
    RAISE EXCEPTION 'Organisation API credential content is immutable; rotate with a new version';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('ROTATED','REVOKED','EXPIRED') THEN
    RAISE EXCEPTION 'Invalid Organisation API credential transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_api_credential_update_guard ON organisation.organisation_api_credential_version;
CREATE TRIGGER organisation_api_credential_update_guard BEFORE UPDATE ON organisation.organisation_api_credential_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_api_credential_update();

DROP TRIGGER IF EXISTS organisation_api_credential_delete_guard ON organisation.organisation_api_credential_version;
CREATE TRIGGER organisation_api_credential_delete_guard BEFORE DELETE ON organisation.organisation_api_credential_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_webhook_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  api_client_id uuid NOT NULL REFERENCES organisation.organisation_api_client(id) ON DELETE RESTRICT,
  event_types text[] NOT NULL,
  endpoint_reference text NOT NULL,
  signature_key_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING_APPROVAL','ACTIVE','SUSPENDED','REVOKED')),
  sensitive_payload_minimised boolean NOT NULL DEFAULT true CHECK (sensitive_payload_minimised = true),
  external_delivery_enabled boolean NOT NULL DEFAULT false CHECK (external_delivery_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(event_types) > 0 AND btrim(endpoint_reference) <> '' AND btrim(signature_key_reference) <> '')
);

CREATE OR REPLACE FUNCTION organisation.guard_webhook_subscription_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status') IS DISTINCT FROM (to_jsonb(NEW) - 'status') THEN
    RAISE EXCEPTION 'Organisation webhook tenant, event and endpoint scope are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'PENDING_APPROVAL' AND NEW.status IN ('ACTIVE','REVOKED'))
    OR (OLD.status = 'ACTIVE' AND NEW.status IN ('SUSPENDED','REVOKED'))
    OR (OLD.status = 'SUSPENDED' AND NEW.status IN ('ACTIVE','REVOKED'))
  ) THEN RAISE EXCEPTION 'Invalid Organisation webhook subscription transition'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_webhook_subscription_update_guard ON organisation.organisation_webhook_subscription;
CREATE TRIGGER organisation_webhook_subscription_update_guard BEFORE UPDATE ON organisation.organisation_webhook_subscription
FOR EACH ROW EXECUTE FUNCTION organisation.guard_webhook_subscription_update();
DROP TRIGGER IF EXISTS organisation_webhook_subscription_delete_guard ON organisation.organisation_webhook_subscription;
CREATE TRIGGER organisation_webhook_subscription_delete_guard BEFORE DELETE ON organisation.organisation_webhook_subscription
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_webhook_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL REFERENCES organisation.organisation_webhook_subscription(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  state text NOT NULL CHECK (state IN ('QUEUED','SENT','DELIVERED','FAILED','UNKNOWN','SUPPRESSED_REPLAY')),
  signature_verified boolean NOT NULL DEFAULT false,
  replay_suppressed boolean NOT NULL DEFAULT false,
  canonical_booking_state_changed_by_delivery_failure boolean NOT NULL DEFAULT false CHECK (canonical_booking_state_changed_by_delivery_failure = false),
  external_delivery_enabled boolean NOT NULL DEFAULT false CHECK (external_delivery_enabled = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, event_id, attempt_number),
  CHECK (state <> 'SUPPRESSED_REPLAY' OR replay_suppressed)
);

DROP TRIGGER IF EXISTS organisation_webhook_delivery_immutable ON organisation.organisation_webhook_delivery;
CREATE TRIGGER organisation_webhook_delivery_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_webhook_delivery
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_export_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  requested_by_membership_id uuid NOT NULL REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  scope jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED','STEP_UP_REQUIRED','APPROVAL_REQUIRED','READY','EXPIRED','REJECTED')),
  expires_at timestamptz NOT NULL,
  step_up_or_approval_satisfied boolean NOT NULL DEFAULT false,
  raw_safety_evidence_included boolean NOT NULL DEFAULT false CHECK (raw_safety_evidence_included = false),
  raw_location_trace_included boolean NOT NULL DEFAULT false CHECK (raw_location_trace_included = false),
  card_information_included boolean NOT NULL DEFAULT false CHECK (card_information_included = false),
  clinical_details_included boolean NOT NULL DEFAULT false CHECK (clinical_details_included = false),
  unrelated_passenger_journeys_included boolean NOT NULL DEFAULT false CHECK (unrelated_passenger_journeys_included = false),
  staff_mutation_enabled boolean NOT NULL DEFAULT false CHECK (staff_mutation_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(purpose) <> '' AND expires_at > created_at),
  CHECK (status <> 'READY' OR step_up_or_approval_satisfied)
);

CREATE OR REPLACE FUNCTION organisation.guard_export_request_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'step_up_or_approval_satisfied')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'step_up_or_approval_satisfied') THEN
    RAISE EXCEPTION 'Organisation export purpose, scope and minimisation truth are immutable';
  END IF;
  IF OLD.status NOT IN ('REQUESTED','STEP_UP_REQUIRED','APPROVAL_REQUIRED')
     OR NEW.status NOT IN ('STEP_UP_REQUIRED','APPROVAL_REQUIRED','READY','EXPIRED','REJECTED')
     OR (OLD.step_up_or_approval_satisfied AND NOT NEW.step_up_or_approval_satisfied) THEN
    RAISE EXCEPTION 'Invalid organisation export request transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisation_export_request_update_guard ON organisation.organisation_export_request;
CREATE TRIGGER organisation_export_request_update_guard BEFORE UPDATE ON organisation.organisation_export_request
FOR EACH ROW EXECUTE FUNCTION organisation.guard_export_request_update();
DROP TRIGGER IF EXISTS organisation_export_request_delete_guard ON organisation.organisation_export_request;
CREATE TRIGGER organisation_export_request_delete_guard BEFORE DELETE ON organisation.organisation_export_request
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  actor_membership_id uuid REFERENCES organisation.organisation_user_membership(id) ON DELETE RESTRICT,
  api_client_id uuid REFERENCES organisation.organisation_api_client(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_id uuid,
  purpose text NOT NULL,
  high_risk boolean NOT NULL DEFAULT false,
  step_up_reference text,
  four_eyes_reference text,
  shield_decision text CHECK (shield_decision IS NULL OR shield_decision IN (
    'ALLOW','ALLOW_AND_MONITOR','STEP_UP','LIMIT','HOLD','REVIEW','BLOCK'
  )),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(event_type) <> '' AND btrim(actor_type) <> '' AND btrim(target_type) <> '' AND btrim(purpose) <> ''),
  CHECK (NOT high_risk OR step_up_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS organisation_audit_event_immutable ON organisation.organisation_audit_event;
CREATE TRIGGER organisation_audit_event_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_audit_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_acceptance_case_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL CHECK (scenario_key IN (
    'SITE_ISOLATION','FINANCE_ONLY_ROLE','DISTINCT_BOOKER_PASSENGER_PAYER',
    'UNRELATED_PASSENGER_BOOKING_DENIED','SCHOOL_ADMIN_SAFEGUARDING_DENIED',
    'ACCESSIBILITY_OVERRIDES_COST_POLICY','MATERIAL_QUOTE_CHANGE_REAPPROVAL',
    'SAFETY_CHANGE_WITHOUT_CORPORATE_APPROVAL','ARREARS_ACTIVE_JOURNEY_CONTINUES',
    'NEW_DEVICE_PRIMARY_ADMIN_STEP_UP','CROSS_TENANT_OBJECT_ACCESS_DENIED',
    'SIGNED_REQUEST_REPLAY_DEDUPLICATED','SENSITIVE_EXPORT_MINIMISED',
    'OFFBOARDING_PRESERVES_PASSENGER_AND_SAFETY'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  condition_description text NOT NULL,
  pass_criteria text NOT NULL,
  fixture_only boolean NOT NULL DEFAULT true CHECK (fixture_only = true),
  external_integration_execution_allowed boolean NOT NULL DEFAULT false CHECK (external_integration_execution_allowed = false),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_key, version),
  CHECK (btrim(condition_description) <> '' AND btrim(pass_criteria) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_organisation_acceptance_case
  ON organisation.organisation_acceptance_case_version (scenario_key) WHERE status = 'ACTIVE';
DROP TRIGGER IF EXISTS organisation_acceptance_case_update_guard ON organisation.organisation_acceptance_case_version;
CREATE TRIGGER organisation_acceptance_case_update_guard BEFORE UPDATE ON organisation.organisation_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION organisation.guard_version_close_update();
DROP TRIGGER IF EXISTS organisation_acceptance_case_delete_guard ON organisation.organisation_acceptance_case_version;
CREATE TRIGGER organisation_acceptance_case_delete_guard BEFORE DELETE ON organisation.organisation_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_command_deduplication (
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

DROP TRIGGER IF EXISTS organisation_command_deduplication_immutable ON organisation.organisation_command_deduplication;
CREATE TRIGGER organisation_command_deduplication_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'OrganisationCreated.v1','OrganisationActivated.v1','OrganisationRestricted.v1',
    'OrganisationRestrictionLifted.v1','OrganisationUserInvited.v1',
    'OrganisationMembershipActivated.v1','OrganisationMembershipRevoked.v1',
    'OrganisationRoleChanged.v1','OrganisationContactChanged.v1',
    'OrganisationAgreementActivated.v1','OrganisationAgreementExpired.v1',
    'OrganisationPolicyChanged.v1','PassengerAddedToRoster.v1','PassengerRemovedFromRoster.v1',
    'OrganisationApprovalRequested.v1','OrganisationApprovalGranted.v1',
    'OrganisationApprovalRejected.v1','OrganisationApiCredentialRotated.v1',
    'OrganisationOffboardingStarted.v1','OrganisationClosed.v1'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensitive_passenger_data_included boolean NOT NULL DEFAULT false CHECK (sensitive_passenger_data_included = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS organisation_event_immutable ON organisation.organisation_event;
CREATE TRIGGER organisation_event_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS organisation.organisation_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisation.organisation(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  external_integration_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_integration_execution_enabled = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS organisation_outbox_message_immutable ON organisation.organisation_outbox_message;
CREATE TRIGGER organisation_outbox_message_immutable BEFORE UPDATE OR DELETE ON organisation.organisation_outbox_message
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
