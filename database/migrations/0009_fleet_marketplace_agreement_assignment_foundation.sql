-- DAZAT Mobility — Engineering Phase 0.9
-- Fleet marketplace, versioned agreement, handover, actual-pair insurance and assignment truth.
-- Supplier stock/terms are evidence-backed; no generic discount or external-tenancy compliance bypass exists.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='vehicle_fleet' AND t.typname='vehicle_access_route') THEN
    CREATE TYPE vehicle_fleet.vehicle_access_route AS ENUM (
      'DRIVER_OWNED','WEEKLY_RENT','RENT_TO_OWN','FIXED_TERM_LEASE','LEASE_TO_OWN'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='vehicle_fleet' AND t.typname='fleet_tier') THEN
    CREATE TYPE vehicle_fleet.fleet_tier AS ENUM (
      'LATEST_MODEL_NEW','BRAND_NEW_OUTGOING_MODEL_YEAR','DAZAT_APPROVED_USED','DRIVER_OWNED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='vehicle_fleet' AND t.typname='fleet_vehicle_state') THEN
    CREATE TYPE vehicle_fleet.fleet_vehicle_state AS ENUM (
      'AVAILABLE','RESERVED','ASSIGNED','IN_SERVICE','MAINTENANCE','REPAIR',
      'QUARANTINED','AWAITING_INSPECTION','RETURN_PENDING','RETIRED'
    );
  END IF;
END $$;

ALTER TABLE vehicle_fleet.vehicle
  ADD COLUMN IF NOT EXISTS fleet_state vehicle_fleet.fleet_vehicle_state NOT NULL DEFAULT 'AWAITING_INSPECTION',
  ADD COLUMN IF NOT EXISTS fleet_state_version bigint NOT NULL DEFAULT 1 CHECK (fleet_state_version > 0),
  ADD COLUMN IF NOT EXISTS body_style text;

CREATE TABLE IF NOT EXISTS vehicle_fleet.fleet_organisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  organisation_reference text NOT NULL UNIQUE,
  tenancy_type text NOT NULL CHECK (tenancy_type IN ('DAZAT_OWNED','EXTERNAL_FLEET')),
  status text NOT NULL CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','ENDED')),
  verification_evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ACTIVE' OR (verified_at IS NOT NULL AND jsonb_array_length(verification_evidence_references) > 0))
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_tenancy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  fleet_organisation_id uuid NOT NULL REFERENCES vehicle_fleet.fleet_organisation(id) ON DELETE RESTRICT,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  source_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, valid_from),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

DROP TRIGGER IF EXISTS vehicle_tenancy_immutable ON vehicle_fleet.vehicle_tenancy;
CREATE TRIGGER vehicle_tenancy_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_tenancy
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_tenancy_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_tenancy tenancy
     WHERE tenancy.id <> NEW.id AND tenancy.vehicle_id = NEW.vehicle_id
       AND tstzrange(tenancy.valid_from, tenancy.valid_until, '[)') && tstzrange(NEW.valid_from, NEW.valid_until, '[)')
  ) THEN RAISE EXCEPTION 'Vehicle tenancy validity windows cannot overlap'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_tenancy_overlap_guard ON vehicle_fleet.vehicle_tenancy;
CREATE CONSTRAINT TRIGGER vehicle_tenancy_overlap_guard
AFTER INSERT ON vehicle_fleet.vehicle_tenancy
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_tenancy_overlap();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_state_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  from_state vehicle_fleet.fleet_vehicle_state NOT NULL,
  to_state vehicle_fleet.fleet_vehicle_state NOT NULL,
  version bigint NOT NULL CHECK (version > 1),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL CHECK (actor_type IN ('SYSTEM','AUTHORISED_STAFF','FLEET_AUTHORITY')),
  actor_id uuid,
  reason_code text NOT NULL,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, version)
);

DROP TRIGGER IF EXISTS vehicle_state_transition_immutable ON vehicle_fleet.vehicle_state_transition;
CREATE TRIGGER vehicle_state_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_state_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_state_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.fleet_state = OLD.fleet_state THEN
    IF NEW.fleet_state_version <> OLD.fleet_state_version THEN RAISE EXCEPTION 'Fleet state version cannot change without a state transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.fleet_state
    WHEN 'AVAILABLE' THEN NEW.fleet_state IN ('RESERVED','ASSIGNED','MAINTENANCE','REPAIR','QUARANTINED','AWAITING_INSPECTION','RETIRED')
    WHEN 'RESERVED' THEN NEW.fleet_state IN ('AVAILABLE','ASSIGNED','MAINTENANCE','QUARANTINED','RETIRED')
    WHEN 'ASSIGNED' THEN NEW.fleet_state IN ('IN_SERVICE','RETURN_PENDING','MAINTENANCE','REPAIR','QUARANTINED')
    WHEN 'IN_SERVICE' THEN NEW.fleet_state IN ('RETURN_PENDING','MAINTENANCE','REPAIR','QUARANTINED')
    WHEN 'MAINTENANCE' THEN NEW.fleet_state IN ('AVAILABLE','REPAIR','QUARANTINED','AWAITING_INSPECTION','RETIRED')
    WHEN 'REPAIR' THEN NEW.fleet_state IN ('AWAITING_INSPECTION','QUARANTINED','RETIRED')
    WHEN 'QUARANTINED' THEN NEW.fleet_state IN ('AWAITING_INSPECTION','REPAIR','RETIRED')
    WHEN 'AWAITING_INSPECTION' THEN NEW.fleet_state IN ('AVAILABLE','MAINTENANCE','REPAIR','QUARANTINED','RETIRED')
    WHEN 'RETURN_PENDING' THEN NEW.fleet_state IN ('MAINTENANCE','REPAIR','QUARANTINED','AWAITING_INSPECTION','RETIRED')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid FleetVehicle transition % -> %', OLD.fleet_state, NEW.fleet_state; END IF;
  IF NEW.fleet_state_version <> OLD.fleet_state_version + 1 THEN RAISE EXCEPTION 'Fleet state transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fleet_vehicle_state_guard ON vehicle_fleet.vehicle;
CREATE TRIGGER fleet_vehicle_state_guard
BEFORE UPDATE OF fleet_state, fleet_state_version ON vehicle_fleet.vehicle
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_state_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_state_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fleet_state IS DISTINCT FROM OLD.fleet_state AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_state_transition transition
     WHERE transition.vehicle_id = NEW.id AND transition.version = NEW.fleet_state_version
       AND transition.from_state = OLD.fleet_state AND transition.to_state = NEW.fleet_state
  ) THEN RAISE EXCEPTION 'FleetVehicle current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fleet_vehicle_state_history_guard ON vehicle_fleet.vehicle;
CREATE CONSTRAINT TRIGGER fleet_vehicle_state_history_guard
AFTER UPDATE ON vehicle_fleet.vehicle
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_state_history();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_capability_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  passenger_capacity integer NOT NULL CHECK (passenger_capacity > 0),
  luggage_capacity integer NOT NULL CHECK (luggage_capacity >= 0),
  wav_capable boolean NOT NULL,
  school_capable boolean NOT NULL,
  executive_capable boolean NOT NULL,
  airport_capable boolean NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  verification_authority text NOT NULL,
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  CHECK (valid_until > evaluated_at)
);

DROP TRIGGER IF EXISTS vehicle_capability_snapshot_immutable ON vehicle_fleet.vehicle_capability_snapshot;
CREATE TRIGGER vehicle_capability_snapshot_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_capability_snapshot
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS vehicle_capability_latest_idx
  ON vehicle_fleet.vehicle_capability_snapshot (vehicle_id, evaluated_at DESC);

CREATE OR REPLACE VIEW vehicle_fleet.current_vehicle_capability AS
SELECT DISTINCT ON (capability.vehicle_id)
       capability.id AS capability_snapshot_id, capability.vehicle_id,
       capability.passenger_capacity, capability.luggage_capacity,
       capability.wav_capable, capability.school_capable,
       capability.executive_capable, capability.airport_capable,
       capability.evidence_references, capability.evaluated_at, capability.valid_until
  FROM vehicle_fleet.vehicle_capability_snapshot capability
 ORDER BY capability.vehicle_id, capability.evaluated_at DESC;

COMMENT ON TABLE vehicle_fleet.vehicle_capability_snapshot IS 'Explicit, evidence-backed capability. Body style is informational and cannot infer WAV, school, executive, airport or capacity truth.';

CREATE TABLE IF NOT EXISTS vehicle_fleet.marketplace_offer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_family_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  supersedes_offer_id uuid REFERENCES vehicle_fleet.marketplace_offer(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  fleet_organisation_id uuid REFERENCES vehicle_fleet.fleet_organisation(id) ON DELETE RESTRICT,
  region_code text NOT NULL,
  access_route vehicle_fleet.vehicle_access_route NOT NULL,
  tier vehicle_fleet.fleet_tier NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','PAUSED','WITHDRAWN','EXPIRED')),
  periodic_charge_minor bigint NOT NULL CHECK (periodic_charge_minor >= 0 AND periodic_charge_minor <= 9007199254740991),
  total_contract_cost_minor bigint NOT NULL CHECK (total_contract_cost_minor >= 0 AND total_contract_cost_minor <= 9007199254740991),
  deposit_minor bigint NOT NULL CHECK (deposit_minor >= 0 AND deposit_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  billing_interval text NOT NULL CHECK (billing_interval IN ('WEEKLY','MONTHLY','NOT_APPLICABLE')),
  term_days integer CHECK (term_days > 0),
  mileage_terms jsonb NOT NULL,
  end_of_term_conditions text[] NOT NULL,
  included_services text[] NOT NULL,
  excluded_services text[] NOT NULL,
  ownership_transfer_terms text[],
  supplier_stock_reference text,
  supplier_stock_verified_at timestamptz,
  warranty_terms text[],
  warranty_verified_at timestamptz,
  generic_discount_claim boolean NOT NULL DEFAULT false CHECK (generic_discount_claim = false),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_family_id, version),
  CHECK (supersedes_offer_id IS NULL OR supersedes_offer_id <> id),
  CHECK ((version = 1 AND supersedes_offer_id IS NULL) OR (version > 1 AND supersedes_offer_id IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (access_route = 'DRIVER_OWNED' OR fleet_organisation_id IS NOT NULL),
  CHECK ((access_route = 'DRIVER_OWNED') = (tier = 'DRIVER_OWNED')),
  CHECK (
    (access_route = 'DRIVER_OWNED' AND billing_interval = 'NOT_APPLICABLE')
    OR (access_route = 'WEEKLY_RENT' AND billing_interval = 'WEEKLY')
    OR (access_route IN ('RENT_TO_OWN','FIXED_TERM_LEASE','LEASE_TO_OWN') AND billing_interval IN ('WEEKLY','MONTHLY'))
  ),
  CHECK (
    access_route = 'DRIVER_OWNED' OR (
      periodic_charge_minor > 0 AND total_contract_cost_minor > 0 AND term_days IS NOT NULL
    )
  ),
  CHECK (access_route NOT IN ('RENT_TO_OWN','LEASE_TO_OWN') OR COALESCE(cardinality(ownership_transfer_terms), 0) > 0),
  CHECK (status <> 'PUBLISHED' OR (
    supplier_stock_reference IS NOT NULL AND supplier_stock_verified_at IS NOT NULL
    AND COALESCE(cardinality(warranty_terms), 0) > 0 AND warranty_verified_at IS NOT NULL
    AND mileage_terms <> '{}'::jsonb AND COALESCE(cardinality(end_of_term_conditions), 0) > 0
  ))
);

DROP TRIGGER IF EXISTS fleet_marketplace_offer_immutable ON vehicle_fleet.marketplace_offer;
CREATE TRIGGER fleet_marketplace_offer_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.marketplace_offer
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_offer_one_successor
  ON vehicle_fleet.marketplace_offer (supersedes_offer_id) WHERE supersedes_offer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_marketplace_offer_version_chain()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.marketplace_offer prior
     WHERE prior.id = NEW.supersedes_offer_id AND prior.offer_family_id = NEW.offer_family_id
       AND prior.version = NEW.version - 1
  ) THEN RAISE EXCEPTION 'Marketplace offer version must directly supersede the prior family version'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS marketplace_offer_version_chain_guard ON vehicle_fleet.marketplace_offer;
CREATE CONSTRAINT TRIGGER marketplace_offer_version_chain_guard
AFTER INSERT ON vehicle_fleet.marketplace_offer
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_marketplace_offer_version_chain();

COMMENT ON TABLE vehicle_fleet.marketplace_offer IS 'Immutable versioned supplier truth. New terms create a new version; generic discount percentage claims are prohibited.';

CREATE TABLE IF NOT EXISTS compliance.driver_vehicle_insurance_validation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  status compliance.eligibility_status NOT NULL,
  insurer_reference text NOT NULL,
  policy_reference text NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  verification_authority text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  CHECK (valid_until > evaluated_at)
);

DROP TRIGGER IF EXISTS driver_vehicle_insurance_validation_immutable ON compliance.driver_vehicle_insurance_validation;
CREATE TRIGGER driver_vehicle_insurance_validation_immutable
BEFORE UPDATE OR DELETE ON compliance.driver_vehicle_insurance_validation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS driver_vehicle_insurance_latest_idx
  ON compliance.driver_vehicle_insurance_validation (driver_profile_id, vehicle_id, evaluated_at DESC);

CREATE OR REPLACE VIEW compliance.current_driver_vehicle_insurance AS
SELECT DISTINCT ON (validation.driver_profile_id, validation.vehicle_id)
       validation.id AS validation_id, validation.driver_profile_id, validation.vehicle_id,
       validation.status, validation.policy_reference, validation.evaluated_at, validation.valid_until
  FROM compliance.driver_vehicle_insurance_validation validation
 ORDER BY validation.driver_profile_id, validation.vehicle_id, validation.evaluated_at DESC;

CREATE OR REPLACE VIEW driver.current_driver_vehicle_authorisation AS
SELECT authorisation.id AS authorisation_id, authorisation.driver_profile_id, authorisation.vehicle_id,
       insurance.validation_id AS insurance_validation_id, insurance.valid_until AS insurance_valid_until
  FROM driver.driver_vehicle_authorisation authorisation
  JOIN compliance.current_driver_vehicle_insurance insurance
    ON insurance.driver_profile_id = authorisation.driver_profile_id AND insurance.vehicle_id = authorisation.vehicle_id
 WHERE authorisation.status = 'ACTIVE' AND authorisation.valid_from <= now()
   AND (authorisation.valid_until IS NULL OR authorisation.valid_until > now())
   AND insurance.status = 'ELIGIBLE' AND insurance.valid_until > now();

COMMENT ON VIEW driver.current_driver_vehicle_authorisation IS 'Actual Driver–vehicle pair authorisation requires separately verified, current pair insurance.';

CREATE TABLE IF NOT EXISTS vehicle_fleet.fleet_agreement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  fleet_organisation_id uuid REFERENCES vehicle_fleet.fleet_organisation(id) ON DELETE RESTRICT,
  access_route vehicle_fleet.vehicle_access_route NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((access_route = 'DRIVER_OWNED') = (fleet_organisation_id IS NULL))
);

DROP TRIGGER IF EXISTS fleet_agreement_immutable ON vehicle_fleet.fleet_agreement;
CREATE TRIGGER fleet_agreement_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.fleet_agreement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.fleet_agreement_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_agreement_id uuid NOT NULL REFERENCES vehicle_fleet.fleet_agreement(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  supersedes_version_id uuid REFERENCES vehicle_fleet.fleet_agreement_version(id) ON DELETE RESTRICT,
  marketplace_offer_id uuid REFERENCES vehicle_fleet.marketplace_offer(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PROPOSED','ACCEPTED','ACTIVE','SUSPENDED','ENDED','CANCELLED')),
  terms_snapshot jsonb NOT NULL,
  periodic_charge_minor bigint NOT NULL CHECK (periodic_charge_minor >= 0 AND periodic_charge_minor <= 9007199254740991),
  total_contract_cost_minor bigint NOT NULL CHECK (total_contract_cost_minor >= 0 AND total_contract_cost_minor <= 9007199254740991),
  deposit_minor bigint NOT NULL CHECK (deposit_minor >= 0 AND deposit_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fleet_agreement_id, version),
  CHECK (supersedes_version_id IS NULL OR supersedes_version_id <> id),
  CHECK ((version = 1 AND supersedes_version_id IS NULL) OR (version > 1 AND supersedes_version_id IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (status NOT IN ('ACCEPTED','ACTIVE') OR accepted_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS fleet_agreement_version_immutable ON vehicle_fleet.fleet_agreement_version;
CREATE TRIGGER fleet_agreement_version_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.fleet_agreement_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE UNIQUE INDEX IF NOT EXISTS fleet_agreement_version_one_successor
  ON vehicle_fleet.fleet_agreement_version (supersedes_version_id) WHERE supersedes_version_id IS NOT NULL;

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_fleet_agreement_version_chain()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.fleet_agreement_version prior
     WHERE prior.id = NEW.supersedes_version_id AND prior.fleet_agreement_id = NEW.fleet_agreement_id
       AND prior.version = NEW.version - 1
  ) THEN RAISE EXCEPTION 'Fleet agreement version must directly supersede the prior agreement version'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fleet_agreement_version_chain_guard ON vehicle_fleet.fleet_agreement_version;
CREATE CONSTRAINT TRIGGER fleet_agreement_version_chain_guard
AFTER INSERT ON vehicle_fleet.fleet_agreement_version
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_fleet_agreement_version_chain();

CREATE OR REPLACE VIEW vehicle_fleet.current_fleet_agreement AS
SELECT DISTINCT ON (agreement.id)
       agreement.id AS agreement_id, agreement.driver_profile_id, agreement.vehicle_id,
       agreement.fleet_organisation_id, agreement.access_route,
       version.id AS agreement_version_id, version.version, version.status,
       version.periodic_charge_minor, version.total_contract_cost_minor, version.deposit_minor,
       version.currency, version.effective_from, version.effective_until
  FROM vehicle_fleet.fleet_agreement agreement
  JOIN vehicle_fleet.fleet_agreement_version version ON version.fleet_agreement_id = agreement.id
 ORDER BY agreement.id, version.version DESC;

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_finance_agreement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_agreement_id uuid NOT NULL UNIQUE REFERENCES vehicle_fleet.fleet_agreement(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vehicle_finance_agreement_immutable ON vehicle_fleet.vehicle_finance_agreement;
CREATE TRIGGER vehicle_finance_agreement_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_finance_agreement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_finance_agreement_route()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.fleet_agreement agreement
     WHERE agreement.id = NEW.fleet_agreement_id AND agreement.access_route IN ('RENT_TO_OWN','LEASE_TO_OWN')
  ) THEN RAISE EXCEPTION 'Vehicle finance agreement requires an ownership-transfer access route'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_finance_agreement_route_guard ON vehicle_fleet.vehicle_finance_agreement;
CREATE CONSTRAINT TRIGGER vehicle_finance_agreement_route_guard
AFTER INSERT ON vehicle_fleet.vehicle_finance_agreement
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_finance_agreement_route();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_finance_agreement_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_finance_agreement_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_finance_agreement(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  supersedes_version_id uuid REFERENCES vehicle_fleet.vehicle_finance_agreement_version(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PROPOSED','ACCEPTED','ACTIVE','SUSPENDED','ENDED','CANCELLED')),
  principal_minor bigint NOT NULL CHECK (principal_minor > 0 AND principal_minor <= 9007199254740991),
  total_payable_minor bigint NOT NULL CHECK (total_payable_minor >= principal_minor AND total_payable_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_schedule jsonb NOT NULL,
  ownership_transfer_conditions text[] NOT NULL,
  policy_reference text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_finance_agreement_id, version),
  CHECK (supersedes_version_id IS NULL OR supersedes_version_id <> id),
  CHECK ((version = 1 AND supersedes_version_id IS NULL) OR (version > 1 AND supersedes_version_id IS NOT NULL)),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

DROP TRIGGER IF EXISTS vehicle_finance_agreement_version_immutable ON vehicle_fleet.vehicle_finance_agreement_version;
CREATE TRIGGER vehicle_finance_agreement_version_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_finance_agreement_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_finance_agreement_version_one_successor
  ON vehicle_fleet.vehicle_finance_agreement_version (supersedes_version_id) WHERE supersedes_version_id IS NOT NULL;

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_finance_agreement_version_chain()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version > 1 AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_finance_agreement_version prior
     WHERE prior.id = NEW.supersedes_version_id
       AND prior.vehicle_finance_agreement_id = NEW.vehicle_finance_agreement_id
       AND prior.version = NEW.version - 1
  ) THEN RAISE EXCEPTION 'Vehicle finance agreement version must directly supersede the prior agreement version'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_finance_agreement_version_chain_guard ON vehicle_fleet.vehicle_finance_agreement_version;
CREATE CONSTRAINT TRIGGER vehicle_finance_agreement_version_chain_guard
AFTER INSERT ON vehicle_fleet.vehicle_finance_agreement_version
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_finance_agreement_version_chain();

CREATE TABLE IF NOT EXISTS vehicle_fleet.deposit_obligation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_agreement_id uuid NOT NULL UNIQUE REFERENCES vehicle_fleet.fleet_agreement(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('NOT_FUNDED','HELD','PARTIALLY_RETURNED','RETURNED','FORFEITURE_PROPOSED','DISPUTED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  is_platform_revenue boolean NOT NULL DEFAULT false CHECK (is_platform_revenue = false),
  finance_ledger_transaction_id uuid REFERENCES finance.ledger_transaction(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'NOT_FUNDED' AND finance_ledger_transaction_id IS NULL)
    OR (status <> 'NOT_FUNDED' AND finance_ledger_transaction_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS vehicle_fleet.deposit_obligation_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_obligation_id uuid NOT NULL REFERENCES vehicle_fleet.deposit_obligation(id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('NOT_FUNDED','HELD','PARTIALLY_RETURNED','RETURNED','FORFEITURE_PROPOSED','DISPUTED')),
  to_status text NOT NULL CHECK (to_status IN ('NOT_FUNDED','HELD','PARTIALLY_RETURNED','RETURNED','FORFEITURE_PROPOSED','DISPUTED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deposit_obligation_id, version),
  CHECK ((version = 1 AND from_status IS NULL AND to_status = 'NOT_FUNDED') OR (version > 1 AND from_status IS NOT NULL))
);

DROP TRIGGER IF EXISTS deposit_obligation_transition_immutable ON vehicle_fleet.deposit_obligation_transition;
CREATE TRIGGER deposit_obligation_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.deposit_obligation_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_deposit_obligation_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.fleet_agreement_id IS DISTINCT FROM OLD.fleet_agreement_id
     OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.is_platform_revenue IS DISTINCT FROM OLD.is_platform_revenue
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Deposit obligation commercial identity is immutable'; END IF;
  IF NEW.finance_ledger_transaction_id IS DISTINCT FROM OLD.finance_ledger_transaction_id
     AND NOT (
       OLD.status = 'NOT_FUNDED' AND NEW.status = 'HELD'
       AND OLD.finance_ledger_transaction_id IS NULL AND NEW.finance_ledger_transaction_id IS NOT NULL
     )
  THEN RAISE EXCEPTION 'Deposit ledger reference is immutable after initial funding'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'Deposit obligation version cannot change without a status transition'; END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'NOT_FUNDED' THEN NEW.status = 'HELD'
    WHEN 'HELD' THEN NEW.status IN ('PARTIALLY_RETURNED','RETURNED','FORFEITURE_PROPOSED','DISPUTED')
    WHEN 'PARTIALLY_RETURNED' THEN NEW.status IN ('RETURNED','FORFEITURE_PROPOSED','DISPUTED')
    WHEN 'FORFEITURE_PROPOSED' THEN NEW.status IN ('HELD','PARTIALLY_RETURNED','RETURNED','DISPUTED')
    WHEN 'DISPUTED' THEN NEW.status IN ('HELD','PARTIALLY_RETURNED','RETURNED','FORFEITURE_PROPOSED')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid deposit obligation transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'Deposit obligation transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_obligation_status_guard ON vehicle_fleet.deposit_obligation;
CREATE TRIGGER deposit_obligation_status_guard
BEFORE UPDATE ON vehicle_fleet.deposit_obligation
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_deposit_obligation_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_deposit_obligation_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.status <> 'NOT_FUNDED' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'Deposit obligation must begin NOT_FUNDED at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.deposit_obligation_transition transition
     WHERE transition.deposit_obligation_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
       AND transition.from_status IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END
  ) THEN RAISE EXCEPTION 'Deposit obligation current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_obligation_history_guard ON vehicle_fleet.deposit_obligation;
CREATE CONSTRAINT TRIGGER deposit_obligation_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.deposit_obligation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_deposit_obligation_history();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_deposit_obligation_agreement_amount()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.current_fleet_agreement agreement
     WHERE agreement.agreement_id = NEW.fleet_agreement_id
       AND agreement.deposit_minor = NEW.amount_minor AND agreement.currency = NEW.currency
  ) THEN RAISE EXCEPTION 'Deposit obligation must match the current FleetAgreement deposit and currency'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_obligation_agreement_amount_guard ON vehicle_fleet.deposit_obligation;
CREATE CONSTRAINT TRIGGER deposit_obligation_agreement_amount_guard
AFTER INSERT ON vehicle_fleet.deposit_obligation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_deposit_obligation_agreement_amount();

CREATE TABLE IF NOT EXISTS vehicle_fleet.deposit_deduction_proposal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_obligation_id uuid NOT NULL REFERENCES vehicle_fleet.deposit_obligation(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  condition_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(condition_evidence_references) = 'array' AND jsonb_array_length(condition_evidence_references) > 0),
  agreement_basis_reference text NOT NULL,
  dispute_route_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('PROPOSED','DISPUTED','APPROVED','REJECTED','SETTLED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  decision_authority text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status IN ('APPROVED','REJECTED','SETTLED') AND decision_authority IS NOT NULL AND decided_at IS NOT NULL) OR status NOT IN ('APPROVED','REJECTED','SETTLED'))
);

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_deposit_deduction_amount()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE held_amount bigint;
        allocated_amount bigint;
BEGIN
  SELECT amount_minor INTO held_amount FROM vehicle_fleet.deposit_obligation
   WHERE id = NEW.deposit_obligation_id FOR UPDATE;
  IF NEW.amount_minor > held_amount THEN RAISE EXCEPTION 'Deposit deduction cannot exceed the recorded deposit obligation'; END IF;
  IF NEW.status IN ('APPROVED','SETTLED') THEN
    SELECT COALESCE(sum(proposal.amount_minor), 0) INTO allocated_amount
      FROM vehicle_fleet.deposit_deduction_proposal proposal
     WHERE proposal.deposit_obligation_id = NEW.deposit_obligation_id
       AND proposal.id <> NEW.id AND proposal.status IN ('APPROVED','SETTLED');
    IF allocated_amount + NEW.amount_minor > held_amount THEN
      RAISE EXCEPTION 'Approved deposit deductions cannot cumulatively exceed the recorded deposit obligation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_deduction_amount_guard ON vehicle_fleet.deposit_deduction_proposal;
CREATE TRIGGER deposit_deduction_amount_guard
BEFORE INSERT OR UPDATE ON vehicle_fleet.deposit_deduction_proposal
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_deposit_deduction_amount();

CREATE TABLE IF NOT EXISTS vehicle_fleet.deposit_deduction_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES vehicle_fleet.deposit_deduction_proposal(id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('PROPOSED','DISPUTED','APPROVED','REJECTED','SETTLED')),
  to_status text NOT NULL CHECK (to_status IN ('PROPOSED','DISPUTED','APPROVED','REJECTED','SETTLED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version),
  CHECK ((version = 1 AND from_status IS NULL AND to_status = 'PROPOSED') OR (version > 1 AND from_status IS NOT NULL))
);

DROP TRIGGER IF EXISTS deposit_deduction_transition_immutable ON vehicle_fleet.deposit_deduction_transition;
CREATE TRIGGER deposit_deduction_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.deposit_deduction_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_deposit_deduction_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.deposit_obligation_id IS DISTINCT FROM OLD.deposit_obligation_id
     OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.condition_evidence_references IS DISTINCT FROM OLD.condition_evidence_references
     OR NEW.agreement_basis_reference IS DISTINCT FROM OLD.agreement_basis_reference
     OR NEW.dispute_route_reference IS DISTINCT FROM OLD.dispute_route_reference
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Deposit deduction evidence and agreement basis are immutable'; END IF;
  IF OLD.decision_authority IS NOT NULL AND (
    NEW.decision_authority IS DISTINCT FROM OLD.decision_authority OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
  ) THEN RAISE EXCEPTION 'Recorded deposit deduction decision authority is immutable'; END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'Deposit deduction version cannot change without a status transition'; END IF;
    IF NEW.decision_authority IS DISTINCT FROM OLD.decision_authority OR NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN
      RAISE EXCEPTION 'Deposit deduction decision facts can change only with a status transition';
    END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'PROPOSED' THEN NEW.status IN ('DISPUTED','APPROVED','REJECTED')
    WHEN 'DISPUTED' THEN NEW.status IN ('APPROVED','REJECTED')
    WHEN 'APPROVED' THEN NEW.status IN ('DISPUTED','SETTLED')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid deposit deduction transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'Deposit deduction transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_deduction_status_guard ON vehicle_fleet.deposit_deduction_proposal;
CREATE TRIGGER deposit_deduction_status_guard
BEFORE UPDATE ON vehicle_fleet.deposit_deduction_proposal
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_deposit_deduction_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_deposit_deduction_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.status <> 'PROPOSED' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'Deposit deduction must begin PROPOSED at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.deposit_deduction_transition transition
     WHERE transition.proposal_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
       AND transition.from_status IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END
  ) THEN RAISE EXCEPTION 'Deposit deduction current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_deduction_history_guard ON vehicle_fleet.deposit_deduction_proposal;
CREATE CONSTRAINT TRIGGER deposit_deduction_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.deposit_deduction_proposal
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_deposit_deduction_history();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_handover_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_agreement_id uuid NOT NULL REFERENCES vehicle_fleet.fleet_agreement(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  handover_type text NOT NULL CHECK (handover_type IN ('ISSUE','RETURN','REPLACEMENT_ISSUE','REPLACEMENT_RETURN')),
  from_party_reference text NOT NULL,
  to_party_reference text NOT NULL,
  mileage integer NOT NULL CHECK (mileage >= 0),
  fuel_or_charge_percent numeric(5,2) CHECK (fuel_or_charge_percent BETWEEN 0 AND 100),
  existing_damage_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment_inventory jsonb NOT NULL DEFAULT '{}'::jsonb,
  key_count integer NOT NULL CHECK (key_count >= 0),
  camera_equipment_present boolean NOT NULL,
  accessibility_equipment_present boolean NOT NULL,
  condition_evidence_references jsonb NOT NULL CHECK (jsonb_typeof(condition_evidence_references) = 'array' AND jsonb_array_length(condition_evidence_references) > 0),
  recorded_by_authority text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vehicle_handover_record_immutable ON vehicle_fleet.vehicle_handover_record;
CREATE TRIGGER vehicle_handover_record_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_handover_record
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_handover_agreement_match()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.fleet_agreement agreement
     WHERE agreement.id = NEW.fleet_agreement_id AND agreement.vehicle_id = NEW.vehicle_id
  ) THEN RAISE EXCEPTION 'Vehicle handover must match the FleetAgreement vehicle'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_handover_agreement_match_guard ON vehicle_fleet.vehicle_handover_record;
CREATE CONSTRAINT TRIGGER vehicle_handover_agreement_match_guard
AFTER INSERT ON vehicle_fleet.vehicle_handover_record
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_handover_agreement_match();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_assignment_validation_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  fleet_agreement_id uuid REFERENCES vehicle_fleet.fleet_agreement(id) ON DELETE RESTRICT,
  replacement_for_assignment_id uuid,
  driver_operating_eligible boolean NOT NULL,
  driver_vehicle_authorised boolean NOT NULL,
  pair_insurance_current boolean NOT NULL,
  vehicle_eligible boolean NOT NULL,
  fleet_state_assignable boolean NOT NULL,
  capabilities_explicit boolean NOT NULL,
  agreement_active boolean NOT NULL,
  external_tenancy boolean NOT NULL DEFAULT false,
  fleet_organisation_active boolean NOT NULL,
  external_tenancy_bypass_allowed boolean NOT NULL DEFAULT false CHECK (external_tenancy_bypass_allowed = false),
  hard_checks_passed boolean NOT NULL,
  evidence_references jsonb NOT NULL CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0),
  policy_version text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  CHECK (valid_until > evaluated_at),
  CHECK (hard_checks_passed = (
    driver_operating_eligible AND driver_vehicle_authorised AND pair_insurance_current
    AND vehicle_eligible AND fleet_state_assignable AND capabilities_explicit AND agreement_active
    AND (NOT external_tenancy OR fleet_organisation_active)
  ))
);

DROP TRIGGER IF EXISTS vehicle_assignment_validation_immutable ON vehicle_fleet.vehicle_assignment_validation_snapshot;
CREATE TRIGGER vehicle_assignment_validation_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_assignment_validation_snapshot
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  fleet_agreement_id uuid NOT NULL REFERENCES vehicle_fleet.fleet_agreement(id) ON DELETE RESTRICT,
  validation_snapshot_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_assignment_validation_snapshot(id) ON DELETE RESTRICT,
  assignment_type text NOT NULL CHECK (assignment_type IN ('PRIMARY','REPLACEMENT')),
  replaces_assignment_id uuid REFERENCES vehicle_fleet.vehicle_assignment(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('RESERVED','ACTIVE','RETURN_PENDING','ENDED','CANCELLED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  assigned_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((assignment_type = 'REPLACEMENT') = (replaces_assignment_id IS NOT NULL)),
  CHECK (status <> 'ACTIVE' OR assigned_at IS NOT NULL),
  CHECK (assigned_at IS NULL OR status IN ('ACTIVE','RETURN_PENDING','ENDED')),
  CHECK (ended_at IS NULL OR status = 'ENDED'),
  CHECK (end_reason IS NULL OR status = 'ENDED'),
  CHECK ((status = 'ENDED' AND assigned_at IS NOT NULL AND ended_at IS NOT NULL AND end_reason IS NOT NULL) OR status <> 'ENDED')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vehicle_assignment_validation_replacement_fk'
       AND conrelid = 'vehicle_fleet.vehicle_assignment_validation_snapshot'::regclass
  ) THEN
    ALTER TABLE vehicle_fleet.vehicle_assignment_validation_snapshot
      ADD CONSTRAINT vehicle_assignment_validation_replacement_fk
      FOREIGN KEY (replacement_for_assignment_id) REFERENCES vehicle_fleet.vehicle_assignment(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_fleet_assignment_per_vehicle
  ON vehicle_fleet.vehicle_assignment (vehicle_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS one_active_fleet_assignment_per_driver
  ON vehicle_fleet.vehicle_assignment (driver_profile_id) WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_active_vehicle_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_assignment_validation_snapshot validation
    JOIN vehicle_fleet.vehicle vehicle ON vehicle.id = validation.vehicle_id
    JOIN vehicle_fleet.current_fleet_agreement agreement ON agreement.agreement_id = validation.fleet_agreement_id
     WHERE validation.id = NEW.validation_snapshot_id
       AND validation.driver_profile_id = NEW.driver_profile_id AND validation.vehicle_id = NEW.vehicle_id
       AND validation.fleet_agreement_id = NEW.fleet_agreement_id
       AND validation.hard_checks_passed = true AND validation.valid_until > now()
       AND agreement.driver_profile_id = NEW.driver_profile_id AND agreement.vehicle_id = NEW.vehicle_id
       AND agreement.status = 'ACTIVE' AND agreement.effective_from <= now()
       AND (agreement.effective_until IS NULL OR agreement.effective_until > now())
       AND vehicle.fleet_state = 'ASSIGNED'
  ) THEN RAISE EXCEPTION 'Active vehicle assignment requires fresh full validation, active agreement and ASSIGNED FleetVehicle state'; END IF;
  IF NEW.assignment_type = 'REPLACEMENT' AND NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_assignment_validation_snapshot validation
     WHERE validation.id = NEW.validation_snapshot_id
       AND validation.replacement_for_assignment_id = NEW.replaces_assignment_id
  ) THEN RAISE EXCEPTION 'Replacement assignment must re-run validation for the replaced assignment'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS active_vehicle_assignment_guard ON vehicle_fleet.vehicle_assignment;
CREATE CONSTRAINT TRIGGER active_vehicle_assignment_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.vehicle_assignment
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_active_vehicle_assignment();

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle_assignment_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_assignment_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle_assignment(id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('RESERVED','ACTIVE','RETURN_PENDING','ENDED','CANCELLED')),
  to_status text NOT NULL CHECK (to_status IN ('RESERVED','ACTIVE','RETURN_PENDING','ENDED','CANCELLED')),
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL UNIQUE,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_assignment_id, version),
  CHECK ((version = 1 AND from_status IS NULL AND to_status = 'RESERVED') OR (version > 1 AND from_status IS NOT NULL))
);

DROP TRIGGER IF EXISTS vehicle_assignment_transition_immutable ON vehicle_fleet.vehicle_assignment_transition;
CREATE TRIGGER vehicle_assignment_transition_immutable
BEFORE UPDATE OR DELETE ON vehicle_fleet.vehicle_assignment_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_assignment_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.driver_profile_id IS DISTINCT FROM OLD.driver_profile_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.fleet_agreement_id IS DISTINCT FROM OLD.fleet_agreement_id
     OR NEW.validation_snapshot_id IS DISTINCT FROM OLD.validation_snapshot_id
     OR NEW.assignment_type IS DISTINCT FROM OLD.assignment_type
     OR NEW.replaces_assignment_id IS DISTINCT FROM OLD.replaces_assignment_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN RAISE EXCEPTION 'Vehicle assignment identity and validation snapshot are immutable'; END IF;
  IF OLD.assigned_at IS NOT NULL AND NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
    RAISE EXCEPTION 'Vehicle assignment activation time is immutable';
  END IF;
  IF OLD.ended_at IS NOT NULL AND (NEW.ended_at IS DISTINCT FROM OLD.ended_at OR NEW.end_reason IS DISTINCT FROM OLD.end_reason) THEN
    RAISE EXCEPTION 'Vehicle assignment end facts are immutable';
  END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.version <> OLD.version THEN RAISE EXCEPTION 'Vehicle assignment version cannot change without a status transition'; END IF;
    IF NEW.assigned_at IS DISTINCT FROM OLD.assigned_at OR NEW.ended_at IS DISTINCT FROM OLD.ended_at OR NEW.end_reason IS DISTINCT FROM OLD.end_reason THEN
      RAISE EXCEPTION 'Vehicle assignment lifecycle facts can change only with a status transition';
    END IF;
    RETURN NEW;
  END IF;
  allowed := CASE OLD.status
    WHEN 'RESERVED' THEN NEW.status IN ('ACTIVE','CANCELLED')
    WHEN 'ACTIVE' THEN NEW.status IN ('RETURN_PENDING','ENDED')
    WHEN 'RETURN_PENDING' THEN NEW.status = 'ENDED'
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid vehicle assignment transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'Vehicle assignment transition must increment version by one'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_assignment_status_guard ON vehicle_fleet.vehicle_assignment;
CREATE TRIGGER vehicle_assignment_status_guard
BEFORE UPDATE ON vehicle_fleet.vehicle_assignment
FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_assignment_transition();

CREATE OR REPLACE FUNCTION vehicle_fleet.guard_vehicle_assignment_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.status <> 'RESERVED' OR NEW.version <> 1) THEN
    RAISE EXCEPTION 'Vehicle assignment must begin RESERVED at version one';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.version = OLD.version THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vehicle_fleet.vehicle_assignment_transition transition
     WHERE transition.vehicle_assignment_id = NEW.id AND transition.version = NEW.version
       AND transition.to_status = NEW.status
       AND transition.from_status IS NOT DISTINCT FROM CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END
  ) THEN RAISE EXCEPTION 'Vehicle assignment current state requires matching append-only transition history'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS vehicle_assignment_history_guard ON vehicle_fleet.vehicle_assignment;
CREATE CONSTRAINT TRIGGER vehicle_assignment_history_guard
AFTER INSERT OR UPDATE ON vehicle_fleet.vehicle_assignment
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vehicle_fleet.guard_vehicle_assignment_history();

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

COMMENT ON VIEW vehicle_fleet.current_marketplace_offer IS 'Only published, current supplier terms for an available and currently eligible vehicle.';

CREATE TABLE IF NOT EXISTS vehicle_fleet.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'fleet.vehicle-state-changed','fleet.offer-published','fleet.agreement-activated',
    'fleet.handover-recorded','fleet.assignment-activated','fleet.assignment-ended',
    'fleet.deposit-deduction-proposed','fleet.deposit-deduction-disputed'
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

CREATE INDEX IF NOT EXISTS fleet_outbox_unpublished_idx
  ON vehicle_fleet.outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE vehicle_fleet.deposit_obligation IS 'Deposit obligation/held-funds reference is separate from platform revenue and requires Finance ledger truth when funded.';
COMMENT ON TABLE vehicle_fleet.vehicle_handover_record IS 'Immutable condition/equipment evidence for issue, replacement and return; not a silent deduction authority.';
COMMENT ON TABLE vehicle_fleet.vehicle_assignment_validation_snapshot IS 'External fleet tenancy never bypasses Driver, vehicle, insurance, capability, agreement or operating eligibility checks.';
