-- DAZAT Mobility — Engineering Phase 0 foundation
-- PostgreSQL 16 + PostGIS. Local/bootstrap migration only; production migration tooling will version checksums and approvals.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS rider;
CREATE SCHEMA IF NOT EXISTS driver;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS vehicle_fleet;
CREATE SCHEMA IF NOT EXISTS booking;
CREATE SCHEMA IF NOT EXISTS pricing;
CREATE SCHEMA IF NOT EXISTS dispatch;
CREATE SCHEMA IF NOT EXISTS journey;
CREATE SCHEMA IF NOT EXISTS safety;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS communications;
CREATE SCHEMA IF NOT EXISTS organisation;
CREATE SCHEMA IF NOT EXISTS school;
CREATE SCHEMA IF NOT EXISTS rescue;
CREATE SCHEMA IF NOT EXISTS shield;

CREATE TABLE IF NOT EXISTS identity.person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.user_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','LIMITED','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Cross-domain-style ownership rule applied even inside one database: account lifecycle owns this logical reference.
  CONSTRAINT user_account_person_fk FOREIGN KEY (person_id) REFERENCES identity.person(id)
);

CREATE TABLE IF NOT EXISTS rider.rider_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LIMITED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver.driver_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE,
  onboarding_status text NOT NULL DEFAULT 'NOT_STARTED',
  operating_status text NOT NULL DEFAULT 'OFFLINE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='booking' AND t.typname='booking_status') THEN
    CREATE TYPE booking.booking_status AS ENUM (
      'DRAFT',
      'QUOTE_CREATED',
      'AWAITING_CONFIRMATION',
      'CONFIRMED',
      'SCHEDULED',
      'READY_FOR_DISPATCH',
      'SEARCHING_FOR_DRIVER',
      'DRIVER_ASSIGNED',
      'DRIVER_EN_ROUTE',
      'DRIVER_ARRIVED',
      'AWAITING_RIDECHECK',
      'PASSENGER_VERIFIED',
      'IN_PROGRESS',
      'ARRIVING',
      'COMPLETED',
      'PAYMENT_PROCESSING',
      'PAID',
      'CLOSED',
      'NO_ELIGIBLE_DRIVER',
      'RIDER_CANCELLED',
      'DRIVER_CANCELLED',
      'OPERATIONS_CANCELLED',
      'RIDER_NO_SHOW',
      'DRIVER_NO_SHOW',
      'PAYMENT_FAILED',
      'SAFETY_HOLD',
      'ACTIVE_INCIDENT',
      'BREAKDOWN',
      'REASSIGNMENT_REQUIRED',
      'REPLACEMENT_SEARCHING',
      'REPLACEMENT_ASSIGNED',
      'REFUND_PENDING',
      'REFUNDED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='booking' AND t.typname='booking_party_role') THEN
    CREATE TYPE booking.booking_party_role AS ENUM (
      'BOOKER', 'PASSENGER', 'PAYER', 'GUARDIAN', 'AUTHORISED_CONTACT', 'ORGANISATION'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS booking.location_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point geography(Point,4326) NOT NULL,
  display_label text NOT NULL,
  structured_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_reference text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking.booking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status booking.booking_status NOT NULL DEFAULT 'DRAFT',
  pickup_snapshot_id uuid NOT NULL REFERENCES booking.location_snapshot(id),
  dropoff_snapshot_id uuid NOT NULL REFERENCES booking.location_snapshot(id),
  scheduled_for timestamptz,
  region_code text NOT NULL,
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking.booking_party (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  role booking.booking_party_role NOT NULL,
  person_id uuid,
  organisation_id uuid,
  display_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (person_id IS NOT NULL OR organisation_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_single_booker
  ON booking.booking_party (booking_id)
  WHERE role = 'BOOKER';

CREATE TABLE IF NOT EXISTS booking.booking_requirement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  requirement_type text NOT NULL,
  requirement_value jsonb NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking.booking_state_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking.booking(id) ON DELETE RESTRICT,
  from_status booking.booking_status,
  to_status booking.booking_status NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  command_id uuid NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  reason_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, aggregate_version),
  UNIQUE (command_id)
);

CREATE OR REPLACE FUNCTION booking.prevent_transition_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'booking_state_transition is append-only';
END;
$$;

DROP TRIGGER IF EXISTS booking_state_transition_immutable_update ON booking.booking_state_transition;
CREATE TRIGGER booking_state_transition_immutable_update
BEFORE UPDATE OR DELETE ON booking.booking_state_transition
FOR EACH ROW EXECUTE FUNCTION booking.prevent_transition_mutation();

CREATE TABLE IF NOT EXISTS booking.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  booking_id uuid,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS booking.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  correlation_id uuid,
  causation_id uuid,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
);

CREATE INDEX IF NOT EXISTS booking_outbox_unpublished_idx
  ON booking.outbox_message (occurred_at)
  WHERE published_at IS NULL;

COMMENT ON TABLE booking.outbox_message IS 'Transactional outbox. Authoritative booking change and event are committed in one database transaction.';
COMMENT ON TABLE booking.booking_state_transition IS 'Append-only canonical Booking transition history.';
COMMENT ON TABLE booking.location_snapshot IS 'Immutable location snapshot captured for a booking; current device location is not authoritative pickup truth.';
