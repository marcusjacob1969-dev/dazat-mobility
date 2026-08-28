-- DAZAT Mobility — Engineering Phase 0.3
-- Verified contact -> revocable session -> Rider booking -> development quote -> confirmation.
-- No production pricing values are introduced by this migration.

ALTER TABLE identity.verification_record
  ADD COLUMN IF NOT EXISTS challenge_salt text,
  ADD COLUMN IF NOT EXISTS challenge_hash text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

CREATE INDEX IF NOT EXISTS identity_pending_contact_verification_idx
  ON identity.verification_record (contact_point_id, attempted_at DESC)
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS identity_verified_contact_auth_unique
  ON identity.authenticator (user_account_id, type, provider_reference)
  WHERE type = 'VERIFIED_CONTACT' AND provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS identity_session_token_hash_idx
  ON identity.session (session_token_hash)
  WHERE session_token_hash IS NOT NULL AND status IN ('ACTIVE','STEP_UP_REQUIRED');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='pricing' AND t.typname='quote_status') THEN
    CREATE TYPE pricing.quote_status AS ENUM ('OFFERED','ACCEPTED','EXPIRED','SUPERSEDED','CANCELLED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pricing.quote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  status pricing.quote_status NOT NULL DEFAULT 'OFFERED',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL CHECK (currency = upper(currency)),
  policy_version text NOT NULL,
  source_mode text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS pricing_quote_booking_idx ON pricing.quote (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pricing.fare_agreement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES pricing.quote(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL CHECK (currency = upper(currency)),
  policy_version text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id),
  UNIQUE (quote_id)
);

CREATE TABLE IF NOT EXISTS pricing.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  booking_id uuid,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS pricing.outbox_message (
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

CREATE INDEX IF NOT EXISTS pricing_outbox_unpublished_idx
  ON pricing.outbox_message (occurred_at)
  WHERE published_at IS NULL;

COMMENT ON COLUMN identity.verification_record.challenge_hash IS 'One-way HMAC verifier for a short-lived contact challenge; raw verification codes are never stored.';
COMMENT ON COLUMN identity.session.session_token_hash IS 'SHA-256 hash of an opaque bearer session secret; plaintext bearer secrets are returned once and never persisted.';
COMMENT ON TABLE pricing.quote IS 'Pricing-owned Quote. booking_id is a logical cross-domain reference and intentionally has no cross-domain foreign key.';
COMMENT ON TABLE pricing.fare_agreement IS 'Pricing-owned immutable commercial agreement derived from an accepted Quote.';
