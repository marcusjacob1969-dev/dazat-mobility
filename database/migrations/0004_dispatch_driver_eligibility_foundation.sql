-- DAZAT Mobility — Engineering Phase 0.4
-- Driver compliance/vehicle eligibility -> availability -> controlled offer -> atomic assignment.
-- Authentication alone never grants operating eligibility.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='compliance' AND t.typname='eligibility_status') THEN
    CREATE TYPE compliance.eligibility_status AS ENUM ('ELIGIBLE','INELIGIBLE','REVIEW_REQUIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='driver' AND t.typname='availability_status') THEN
    CREATE TYPE driver.availability_status AS ENUM ('OFFLINE','AVAILABLE','OFFERED','ASSIGNED','BREAK','FINISHING_SOON');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='dispatch' AND t.typname='attempt_status') THEN
    CREATE TYPE dispatch.attempt_status AS ENUM ('SEARCHING','OFFERING','ASSIGNED','NO_ELIGIBLE_DRIVER','CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='dispatch' AND t.typname='offer_status') THEN
    CREATE TYPE dispatch.offer_status AS ENUM ('OFFERED','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN','LOST_RACE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='dispatch' AND t.typname='assignment_status') THEN
    CREATE TYPE dispatch.assignment_status AS ENUM ('ACTIVE','CANCELLED','COMPLETED','REASSIGNED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_fleet.vehicle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_mark text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'GB',
  lifecycle_status text NOT NULL DEFAULT 'PENDING' CHECK (lifecycle_status IN ('PENDING','ACTIVE','SUSPENDED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction, registration_mark)
);

CREATE TABLE IF NOT EXISTS driver.driver_vehicle_authorisation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED','ENDED')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  UNIQUE (driver_profile_id, vehicle_id, valid_from)
);

CREATE INDEX IF NOT EXISTS driver_active_vehicle_authorisation_idx
  ON driver.driver_vehicle_authorisation (driver_profile_id, vehicle_id, valid_until)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS compliance.driver_eligibility_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL,
  status compliance.eligibility_status NOT NULL,
  policy_version text NOT NULL,
  blocker_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > evaluated_at)
);

CREATE INDEX IF NOT EXISTS compliance_driver_snapshot_latest_idx
  ON compliance.driver_eligibility_snapshot (driver_profile_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS compliance.vehicle_eligibility_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL,
  status compliance.eligibility_status NOT NULL,
  policy_version text NOT NULL,
  blocker_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  service_capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > evaluated_at)
);

CREATE INDEX IF NOT EXISTS compliance_vehicle_snapshot_latest_idx
  ON compliance.vehicle_eligibility_snapshot (vehicle_id, evaluated_at DESC);

CREATE OR REPLACE FUNCTION compliance.prevent_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS compliance_driver_eligibility_immutable ON compliance.driver_eligibility_snapshot;
CREATE TRIGGER compliance_driver_eligibility_immutable
BEFORE UPDATE OR DELETE ON compliance.driver_eligibility_snapshot
FOR EACH ROW EXECUTE FUNCTION compliance.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS compliance_vehicle_eligibility_immutable ON compliance.vehicle_eligibility_snapshot;
CREATE TRIGGER compliance_vehicle_eligibility_immutable
BEFORE UPDATE OR DELETE ON compliance.vehicle_eligibility_snapshot
FOR EACH ROW EXECUTE FUNCTION compliance.prevent_snapshot_mutation();

CREATE TABLE IF NOT EXISTS driver.availability_state (
  driver_profile_id uuid PRIMARY KEY REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  status driver.availability_status NOT NULL DEFAULT 'OFFLINE',
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  region_code text,
  vehicle_id uuid,
  location geography(Point,4326),
  location_observed_at timestamptz,
  location_source text,
  location_confidence numeric(4,3),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (location_confidence IS NULL OR (location_confidence >= 0 AND location_confidence <= 1)),
  CHECK (status = 'OFFLINE' OR (region_code IS NOT NULL AND vehicle_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS driver_available_region_idx
  ON driver.availability_state (region_code, status, updated_at)
  WHERE status IN ('AVAILABLE','FINISHING_SOON');

CREATE TABLE IF NOT EXISTS driver.availability_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL,
  from_status driver.availability_status,
  to_status driver.availability_status NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  command_id uuid NOT NULL,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_profile_id, version),
  UNIQUE (command_id)
);

DROP TRIGGER IF EXISTS driver_availability_transition_immutable ON driver.availability_transition;
CREATE TRIGGER driver_availability_transition_immutable
BEFORE UPDATE OR DELETE ON driver.availability_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS dispatch.dispatch_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  booking_aggregate_version bigint NOT NULL CHECK (booking_aggregate_version > 0),
  status dispatch.attempt_status NOT NULL DEFAULT 'SEARCHING',
  region_code text NOT NULL,
  policy_version text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, attempt_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS dispatch_one_live_attempt_per_booking
  ON dispatch.dispatch_attempt (booking_id)
  WHERE status IN ('SEARCHING','OFFERING');

CREATE TABLE IF NOT EXISTS dispatch.candidate_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_attempt_id uuid NOT NULL REFERENCES dispatch.dispatch_attempt(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  driver_eligibility_snapshot_id uuid NOT NULL,
  vehicle_eligibility_snapshot_id uuid NOT NULL,
  availability_version bigint NOT NULL CHECK (availability_version > 0),
  provisional_pickup_distance_metres integer CHECK (provisional_pickup_distance_metres >= 0),
  rank_position integer NOT NULL CHECK (rank_position > 0),
  rank_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_attempt_id, driver_profile_id)
);

CREATE TABLE IF NOT EXISTS dispatch.driver_offer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_attempt_id uuid NOT NULL REFERENCES dispatch.dispatch_attempt(id) ON DELETE RESTRICT,
  candidate_snapshot_id uuid NOT NULL REFERENCES dispatch.candidate_snapshot(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL,
  driver_profile_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  wave_number integer NOT NULL DEFAULT 1 CHECK (wave_number > 0),
  status dispatch.offer_status NOT NULL DEFAULT 'OFFERED',
  meaningful_offer_payload jsonb NOT NULL,
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  response_reason text,
  CHECK (expires_at > offered_at),
  UNIQUE (dispatch_attempt_id, driver_profile_id)
);

CREATE INDEX IF NOT EXISTS dispatch_active_driver_offer_idx
  ON dispatch.driver_offer (driver_profile_id, expires_at)
  WHERE status = 'OFFERED';

CREATE TABLE IF NOT EXISTS dispatch.driver_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_attempt_id uuid NOT NULL REFERENCES dispatch.dispatch_attempt(id) ON DELETE RESTRICT,
  accepted_offer_id uuid NOT NULL REFERENCES dispatch.driver_offer(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL,
  driver_profile_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  status dispatch.assignment_status NOT NULL DEFAULT 'ACTIVE',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS dispatch_one_active_assignment_per_booking
  ON dispatch.driver_assignment (booking_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_one_active_assignment_per_driver
  ON dispatch.driver_assignment (driver_profile_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS dispatch.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  subject_id uuid NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, subject_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS dispatch.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  correlation_id uuid,
  causation_id uuid,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text
);

CREATE INDEX IF NOT EXISTS dispatch_outbox_unpublished_idx
  ON dispatch.outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE compliance.driver_eligibility_snapshot IS 'Append-only compliance decision. Authentication does not create this decision.';
COMMENT ON TABLE compliance.vehicle_eligibility_snapshot IS 'Append-only vehicle/service capability decision used by Dispatch hard filters.';
COMMENT ON TABLE driver.availability_state IS 'Driver intent and fresh location context. OFFLINE clears ordinary app location.';
COMMENT ON TABLE dispatch.candidate_snapshot IS 'Evidence of hard-filter eligibility at candidate selection time; acceptance must revalidate.';
COMMENT ON TABLE dispatch.driver_assignment IS 'Atomic assignment truth. Partial unique indexes prevent two active assignments for one Booking or Driver.';
