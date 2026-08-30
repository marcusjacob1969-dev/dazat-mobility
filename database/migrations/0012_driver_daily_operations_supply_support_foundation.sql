-- DAZAT Mobility — Engineering Phase 0.12
-- Driver daily operations, informed offers, weak-signal recovery, capability-aware supply and Driver Support.
-- Blind offers, guaranteed-earning heatmaps, passenger discrimination and pretend offline command execution are prohibited.

ALTER TABLE driver.availability_state
  DROP CONSTRAINT IF EXISTS driver_availability_offline_ordinary_location_check;
ALTER TABLE driver.availability_state
  ADD CONSTRAINT driver_availability_offline_ordinary_location_check
  CHECK (
    status <> 'OFFLINE'
    OR location IS NULL
    OR location_source = 'FLEET_TELEMATICS'
  );

CREATE TABLE IF NOT EXISTS driver.driver_shift_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE','ENDED')),
  region_code text NOT NULL,
  selected_vehicle_id uuid NOT NULL REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  start_availability_version bigint NOT NULL CHECK (start_availability_version > 0),
  end_availability_version bigint CHECK (end_availability_version IS NULL OR end_availability_version >= start_availability_version),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  ordinary_offline_app_location_collection_allowed boolean NOT NULL DEFAULT false
    CHECK (ordinary_offline_app_location_collection_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'ACTIVE' AND ended_at IS NULL AND end_availability_version IS NULL AND end_reason IS NULL)
    OR (status = 'ENDED' AND ended_at IS NOT NULL AND end_availability_version IS NOT NULL AND end_reason IS NOT NULL)
  ),
  CHECK (btrim(region_code) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_one_active_shift_per_driver
  ON driver.driver_shift_session (driver_profile_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS driver.driver_shift_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_shift_session_id uuid NOT NULL REFERENCES driver.driver_shift_session(id) ON DELETE RESTRICT,
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'SHIFT_STARTED','WORK_INTENT_CHANGED','OFFER_ACCEPTED','JOURNEY_COMPLETED_AVAILABLE',
    'UNSAFE_TERMINATION_BREAK','SHIFT_ENDED'
  )),
  from_availability driver.availability_status,
  to_availability driver.availability_status NOT NULL,
  availability_version bigint NOT NULL CHECK (availability_version > 0),
  command_id uuid NOT NULL,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_profile_id, availability_version),
  UNIQUE (command_id)
);

DROP TRIGGER IF EXISTS driver_shift_event_immutable ON driver.driver_shift_event;
CREATE TRIGGER driver_shift_event_immutable
BEFORE UPDATE OR DELETE ON driver.driver_shift_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION driver.guard_shift_session_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.driver_profile_id IS DISTINCT FROM NEW.driver_profile_id
     OR OLD.region_code IS DISTINCT FROM NEW.region_code
     OR OLD.selected_vehicle_id IS DISTINCT FROM NEW.selected_vehicle_id
     OR OLD.start_availability_version IS DISTINCT FROM NEW.start_availability_version
     OR OLD.started_at IS DISTINCT FROM NEW.started_at
     OR OLD.ordinary_offline_app_location_collection_allowed IS DISTINCT FROM NEW.ordinary_offline_app_location_collection_allowed
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'DriverShiftSession identity and start truth are immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status <> 'ENDED' THEN
    RAISE EXCEPTION 'DriverShiftSession only permits ACTIVE to ENDED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_shift_session_guard ON driver.driver_shift_session;
CREATE TRIGGER driver_shift_session_guard
BEFORE UPDATE ON driver.driver_shift_session
FOR EACH ROW EXECUTE FUNCTION driver.guard_shift_session_update();

CREATE TABLE IF NOT EXISTS driver.scheduled_work_commitment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  assignment_id uuid REFERENCES dispatch.driver_assignment(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACCEPTED','CANCELLED','COMPLETED','MISSED')),
  service_code text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  protected_from timestamptz NOT NULL,
  protected_until timestamptz NOT NULL,
  policy_version text NOT NULL,
  accepted_commitment_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (protected_from <= scheduled_for AND protected_until >= scheduled_for AND protected_until > protected_from),
  CHECK (btrim(service_code) <> '' AND btrim(policy_version) <> ''),
  CHECK (jsonb_typeof(accepted_commitment_evidence) = 'array'),
  CHECK (status <> 'ACCEPTED' OR jsonb_array_length(accepted_commitment_evidence) > 0),
  UNIQUE (driver_profile_id, booking_id)
);

CREATE INDEX IF NOT EXISTS driver_open_scheduled_commitment_idx
  ON driver.scheduled_work_commitment (driver_profile_id, protected_from, protected_until)
  WHERE status = 'ACCEPTED';

CREATE TABLE IF NOT EXISTS driver.scheduled_work_commitment_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES driver.scheduled_work_commitment(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('ACCEPTED','CANCELLED','COMPLETED','MISSED')),
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS scheduled_work_commitment_event_immutable ON driver.scheduled_work_commitment_event;
CREATE TRIGGER scheduled_work_commitment_event_immutable
BEFORE UPDATE OR DELETE ON driver.scheduled_work_commitment_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.homeward_preference_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  region_code text NOT NULL,
  preferred_area geography(Point,4326) NOT NULL,
  radius_metres integer NOT NULL CHECK (radius_metres > 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hard_eligibility_bypass_allowed boolean NOT NULL DEFAULT false CHECK (hard_eligibility_bypass_allowed = false),
  passenger_attribute_use_allowed boolean NOT NULL DEFAULT false CHECK (passenger_attribute_use_allowed = false),
  guaranteed_trip_claim_allowed boolean NOT NULL DEFAULT false CHECK (guaranteed_trip_claim_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > effective_from),
  UNIQUE (driver_profile_id, version)
);

DROP TRIGGER IF EXISTS homeward_preference_version_immutable ON driver.homeward_preference_version;
CREATE TRIGGER homeward_preference_version_immutable
BEFORE UPDATE OR DELETE ON driver.homeward_preference_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS dispatch.driver_offer_disclosure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_offer_id uuid NOT NULL UNIQUE REFERENCES dispatch.driver_offer(id) ON DELETE RESTRICT,
  service_codes text[] NOT NULL,
  journey_context_labels text[] NOT NULL,
  pickup_distance_metres integer CHECK (pickup_distance_metres >= 0),
  pickup_eta_status text NOT NULL CHECK (pickup_eta_status IN ('AVAILABLE','UNAVAILABLE_ROUTE_ESTIMATE_NOT_CONFIGURED')),
  pickup_eta_minutes integer CHECK (pickup_eta_minutes IS NULL OR pickup_eta_minutes >= 0),
  expected_earning_status text NOT NULL CHECK (expected_earning_status IN ('VERIFIED_ESTIMATE','UNAVAILABLE_FINANCE_POLICY_NOT_APPROVED')),
  expected_earning_amount_minor bigint CHECK (expected_earning_amount_minor IS NULL OR (expected_earning_amount_minor >= 0 AND expected_earning_amount_minor <= 9007199254740991)),
  expected_earning_currency char(3) CHECK (expected_earning_currency IS NULL OR (expected_earning_currency = upper(expected_earning_currency) AND expected_earning_currency ~ '^[A-Z]{3}$')),
  expected_earning_policy_version text,
  expected_earning_derived_from_rider_fare boolean NOT NULL DEFAULT false CHECK (expected_earning_derived_from_rider_fare = false),
  informed_choice_ready boolean NOT NULL,
  acceptance_allowed boolean NOT NULL,
  missing_disclosures text[] NOT NULL DEFAULT ARRAY[]::text[],
  blind_offer_prohibited boolean NOT NULL DEFAULT true CHECK (blind_offer_prohibited = true),
  ordinary_decline_penalty_applied boolean NOT NULL DEFAULT false CHECK (ordinary_decline_penalty_applied = false),
  captured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(service_codes) > 0),
  CHECK (cardinality(journey_context_labels) > 0),
  CHECK ((pickup_eta_status = 'AVAILABLE') = (pickup_eta_minutes IS NOT NULL)),
  CHECK (
    (expected_earning_status = 'VERIFIED_ESTIMATE') =
    (expected_earning_amount_minor IS NOT NULL AND expected_earning_currency IS NOT NULL AND expected_earning_policy_version IS NOT NULL)
  ),
  CHECK (acceptance_allowed = informed_choice_ready),
  CHECK (NOT informed_choice_ready OR cardinality(missing_disclosures) = 0),
  CHECK (
    NOT informed_choice_ready
    OR (
      pickup_distance_metres IS NOT NULL
      AND pickup_eta_status = 'AVAILABLE'
      AND expected_earning_status = 'VERIFIED_ESTIMATE'
    )
  )
);

DROP TRIGGER IF EXISTS driver_offer_disclosure_immutable ON dispatch.driver_offer_disclosure;
CREATE TRIGGER driver_offer_disclosure_immutable
BEFORE UPDATE OR DELETE ON dispatch.driver_offer_disclosure
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS driver.connectivity_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  client_observation_id uuid NOT NULL,
  network_reachable boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  last_server_sync_at timestamptz,
  known_availability_version bigint CHECK (known_availability_version IS NULL OR known_availability_version > 0),
  known_active_journey_id uuid,
  known_active_journey_version bigint CHECK (known_active_journey_version IS NULL OR known_active_journey_version > 0),
  queued_critical_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  queued_critical_event_count integer NOT NULL CHECK (queued_critical_event_count >= 0),
  authoritative_availability_status driver.availability_status NOT NULL,
  authoritative_availability_version bigint NOT NULL CHECK (authoritative_availability_version > 0),
  authoritative_active_journey_id uuid,
  authoritative_active_journey_version bigint CHECK (authoritative_active_journey_version IS NULL OR authoritative_active_journey_version > 0),
  connectivity_state text NOT NULL CHECK (connectivity_state IN ('ONLINE','DEGRADED','OFFLINE','RECOVERING','STALE')),
  authoritative_snapshot_required boolean NOT NULL,
  speculative_state_may_be_trusted boolean NOT NULL DEFAULT false CHECK (speculative_state_may_be_trusted = false),
  queued_critical_events_executed boolean NOT NULL DEFAULT false CHECK (queued_critical_events_executed = false),
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_profile_id, client_observation_id),
  CHECK (jsonb_typeof(queued_critical_events) = 'array')
);

DROP TRIGGER IF EXISTS connectivity_reconciliation_immutable ON driver.connectivity_reconciliation;
CREATE TRIGGER connectivity_reconciliation_immutable
BEFORE UPDATE OR DELETE ON driver.connectivity_reconciliation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS driver_connectivity_latest_idx
  ON driver.connectivity_reconciliation (driver_profile_id, reconciled_at DESC);

CREATE TABLE IF NOT EXISTS communications.arrival_communication_plan_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','AUTHORISED','SUPERSEDED','CANCELLED')),
  pickup_snapshot_id uuid NOT NULL REFERENCES booking.location_snapshot(id) ON DELETE RESTRICT,
  channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  recipient_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  protected_contact_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  driver_instructions text[] NOT NULL DEFAULT ARRAY[]::text[],
  passenger_gps_assumed_as_pickup boolean NOT NULL DEFAULT false CHECK (passenger_gps_assumed_as_pickup = false),
  direct_contact_details_exposed boolean NOT NULL DEFAULT false CHECK (direct_contact_details_exposed = false),
  communication_execution_enabled boolean NOT NULL DEFAULT false CHECK (communication_execution_enabled = false),
  policy_version text NOT NULL,
  authorised_by uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  authorised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, version),
  CHECK ((status = 'AUTHORISED' AND authorised_by IS NOT NULL AND authorised_at IS NOT NULL) OR status <> 'AUTHORISED'),
  CHECK (channels <@ ARRAY['IN_APP','PUSH','SMS','TELEPHONE','CARER_OR_RECEPTION']::text[]),
  CHECK (jsonb_typeof(protected_contact_references) = 'array'),
  CHECK (btrim(policy_version) <> '')
);

DROP TRIGGER IF EXISTS arrival_communication_plan_version_immutable ON communications.arrival_communication_plan_version;
CREATE TRIGGER arrival_communication_plan_version_immutable
BEFORE UPDATE OR DELETE ON communications.arrival_communication_plan_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS operations.driver_support_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL REFERENCES driver.driver_profile(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('SAFETY','BREAKDOWN','PAYMENTS','ACCOUNT','COMPLIANCE','TECHNICAL','PASSENGER','FLEET')),
  risk text NOT NULL CHECK (risk IN ('ROUTINE','PRIORITY','HIGH_RISK_ACTIVE')),
  status text NOT NULL CHECK (status IN ('OPEN','HUMAN_ESCALATION_REQUIRED','IN_PROGRESS','RESOLVED','CLOSED')),
  journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES vehicle_fleet.vehicle(id) ON DELETE RESTRICT,
  summary_reference text NOT NULL,
  human_escalation_required boolean NOT NULL,
  external_service_contacted boolean NOT NULL DEFAULT false CHECK (external_service_contacted = false),
  created_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((risk = 'HIGH_RISK_ACTIVE') = human_escalation_required),
  CHECK (btrim(summary_reference) <> ''),
  CHECK (
    (human_escalation_required AND status IN ('HUMAN_ESCALATION_REQUIRED','IN_PROGRESS','RESOLVED','CLOSED'))
    OR (NOT human_escalation_required AND status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'))
  )
);

CREATE INDEX IF NOT EXISTS driver_open_support_case_idx
  ON operations.driver_support_case (driver_profile_id, created_at DESC)
  WHERE status IN ('OPEN','HUMAN_ESCALATION_REQUIRED','IN_PROGRESS');

CREATE TABLE IF NOT EXISTS operations.driver_support_case_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_case_id uuid NOT NULL REFERENCES operations.driver_support_case(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('OPEN','HUMAN_ESCALATION_REQUIRED','IN_PROGRESS','RESOLVED','CLOSED')),
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text NOT NULL,
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS driver_support_case_event_immutable ON operations.driver_support_case_event;
CREATE TRIGGER driver_support_case_event_immutable
BEFORE UPDATE OR DELETE ON operations.driver_support_case_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS operations.supply_demand_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('CURRENT_OBSERVATION','FORECAST')),
  region_code text NOT NULL,
  capability_code text NOT NULL,
  demand_count integer NOT NULL CHECK (demand_count >= 0),
  eligible_supply_count integer NOT NULL CHECK (eligible_supply_count >= 0),
  observed_or_forecast_at timestamptz NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_reference text NOT NULL,
  evidence_references jsonb NOT NULL,
  guaranteed_earnings boolean NOT NULL DEFAULT false CHECK (guaranteed_earnings = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(region_code) <> '' AND btrim(capability_code) <> '' AND btrim(source_reference) <> ''),
  CHECK (jsonb_typeof(evidence_references) = 'array' AND jsonb_array_length(evidence_references) > 0)
);

DROP TRIGGER IF EXISTS supply_demand_observation_immutable ON operations.supply_demand_observation;
CREATE TRIGGER supply_demand_observation_immutable
BEFORE UPDATE OR DELETE ON operations.supply_demand_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS supply_demand_region_latest_idx
  ON operations.supply_demand_observation (region_code, capability_code, kind, observed_or_forecast_at DESC);

CREATE TABLE IF NOT EXISTS driver.daily_operations_command_deduplication (
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

CREATE TABLE IF NOT EXISTS driver.daily_operations_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'driver.connectivity-reconciled','driver.support-case-opened','driver.work-intent-changed','driver.shift-ended'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS driver_daily_operations_outbox_unpublished_idx
  ON driver.daily_operations_outbox_message (occurred_at) WHERE published_at IS NULL;

CREATE OR REPLACE VIEW driver.current_daily_operations_projection AS
SELECT profile.id AS driver_profile_id,
       COALESCE(availability.status, 'OFFLINE'::driver.availability_status) AS availability_status,
       COALESCE(availability.version, 0) AS availability_version,
       availability.region_code,
       availability.vehicle_id,
       shift.id AS shift_id,
       shift.started_at AS shift_started_at,
       assignment.id AS active_assignment_id,
       active_journey.id AS active_journey_id,
       active_journey.aggregate_version AS active_journey_version,
       (SELECT count(*) FROM dispatch.driver_offer offer
         WHERE offer.driver_profile_id = profile.id AND offer.status = 'OFFERED' AND offer.expires_at > now()) AS open_offer_count,
       (SELECT count(*) FROM finance.driver_earning earning
         WHERE earning.driver_profile_id = profile.id AND earning.status IN ('POSTED','ADJUSTED')) AS posted_earning_count,
       (SELECT count(*) FROM operations.driver_support_case support_case
         WHERE support_case.driver_profile_id = profile.id
           AND support_case.status IN ('OPEN','HUMAN_ESCALATION_REQUIRED','IN_PROGRESS')) AS open_support_case_count
  FROM driver.driver_profile profile
  LEFT JOIN driver.availability_state availability ON availability.driver_profile_id = profile.id
  LEFT JOIN driver.driver_shift_session shift ON shift.driver_profile_id = profile.id AND shift.status = 'ACTIVE'
  LEFT JOIN dispatch.driver_assignment assignment ON assignment.driver_profile_id = profile.id AND assignment.status = 'ACTIVE'
  LEFT JOIN journey.journey active_journey ON active_journey.active_assignment_id = assignment.id
    AND active_journey.status NOT IN ('COMPLETED');

CREATE OR REPLACE VIEW operations.current_supply_demand_projection AS
SELECT DISTINCT ON (region_code, capability_code, kind)
       id, kind, region_code, capability_code, demand_count, eligible_supply_count,
       observed_or_forecast_at, confidence, source_reference, evidence_references, guaranteed_earnings
  FROM operations.supply_demand_observation
 ORDER BY region_code, capability_code, kind, observed_or_forecast_at DESC, created_at DESC;

COMMENT ON TABLE driver.driver_shift_session IS 'Daily Driver shift boundary. BREAK and FINISHING_SOON are normal work intent; OFFLINE ends ordinary app location collection.';
COMMENT ON TABLE dispatch.driver_offer_disclosure IS 'Immutable informed-choice disclosure. Acceptance fails closed until pickup ETA and an independent Driver-earning estimate exist.';
COMMENT ON TABLE driver.connectivity_reconciliation IS 'Weak-signal reconciliation replaces speculative state but never pretends queued critical events were executed.';
COMMENT ON TABLE communications.arrival_communication_plan_version IS 'Versioned scoped arrival plan using the chosen Booking pickup, never assumed passenger GPS.';
COMMENT ON TABLE operations.driver_support_case IS 'Driver Support truth. High-risk active cases require human escalation; this foundation contacts no external service.';
COMMENT ON TABLE operations.supply_demand_observation IS 'Evidence-backed current or forecast demand/supply by capability. It never guarantees earnings.';
