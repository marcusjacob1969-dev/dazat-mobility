-- DAZAT Mobility — Engineering Phase 0.2 identity & account foundation
-- Builds passkey-ready, revocable authentication/session records without storing private credentials.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='contact_point_type') THEN
    CREATE TYPE identity.contact_point_type AS ENUM ('EMAIL','MOBILE','LANDLINE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='name_type') THEN
    CREATE TYPE identity.name_type AS ENUM ('PREFERRED','DISPLAY','LEGAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='contact_status') THEN
    CREATE TYPE identity.contact_status AS ENUM ('ACTIVE','COMPROMISED','REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='verification_status') THEN
    CREATE TYPE identity.verification_status AS ENUM ('PENDING','VERIFIED','FAILED','EXPIRED','REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='authenticator_type') THEN
    CREATE TYPE identity.authenticator_type AS ENUM ('PASSKEY','PASSWORD','VERIFIED_CONTACT','FUTURE_FACTOR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='authenticator_status') THEN
    CREATE TYPE identity.authenticator_status AS ENUM ('PENDING','ACTIVE','REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='device_trust_status') THEN
    CREATE TYPE identity.device_trust_status AS ENUM ('UNKNOWN','RECOGNISED','TRUSTED','RESTRICTED','REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='session_status') THEN
    CREATE TYPE identity.session_status AS ENUM ('ACTIVE','STEP_UP_REQUIRED','REVOKED','EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='identity' AND t.typname='recovery_state') THEN
    CREATE TYPE identity.recovery_state AS ENUM (
      'STARTED','IDENTITY_ASSESSMENT','CONTACT_ASSESSMENT','STEP_UP_REQUIRED','REVIEW_REQUIRED',
      'RECOVERY_APPROVED','SECURITY_RESET','RECOVERY_COMPLETE','DECLINED','ABANDONED','LOCKED_FOR_REVIEW'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity.person_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  name_type identity.name_type NOT NULL,
  value text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 200),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_one_current_preferred_name
  ON identity.person_name (person_id, name_type)
  WHERE effective_to IS NULL AND name_type = 'PREFERRED';

CREATE TABLE IF NOT EXISTS identity.contact_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  user_account_id uuid REFERENCES identity.user_account(id) ON DELETE RESTRICT,
  type identity.contact_point_type NOT NULL,
  normalized_value text NOT NULL,
  display_hint text NOT NULL,
  status identity.contact_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_account_id, type, normalized_value)
);

CREATE INDEX IF NOT EXISTS identity_contact_lookup_idx
  ON identity.contact_point (type, normalized_value)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS identity.verification_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES identity.contact_point(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  method text NOT NULL,
  status identity.verification_status NOT NULL DEFAULT 'PENDING',
  provider_reference text,
  challenge_reference_hash text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS identity.contact_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_point_id uuid NOT NULL REFERENCES identity.contact_point(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  status text NOT NULL CHECK (status IN ('ALLOWED','DENIED','REVOKED')),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS identity.authenticator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE RESTRICT,
  type identity.authenticator_type NOT NULL,
  status identity.authenticator_status NOT NULL DEFAULT 'PENDING',
  label text,
  credential_id bytea,
  credential_public_key bytea,
  sign_count bigint NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  transports text[] NOT NULL DEFAULT ARRAY[]::text[],
  aaguid uuid,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  CHECK (type <> 'PASSKEY' OR credential_id IS NOT NULL OR status = 'PENDING'),
  CHECK (type <> 'PASSKEY' OR credential_public_key IS NOT NULL OR status = 'PENDING')
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_passkey_credential_unique
  ON identity.authenticator (credential_id)
  WHERE type = 'PASSKEY' AND credential_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS identity.device_trust_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE RESTRICT,
  device_instance_id text NOT NULL,
  platform text,
  app_installation_id text,
  credential_type text,
  trust_status identity.device_trust_status NOT NULL DEFAULT 'UNKNOWN',
  integrity_state text NOT NULL DEFAULT 'UNKNOWN',
  risk_state text NOT NULL DEFAULT 'UNKNOWN',
  last_successful_authentication_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  UNIQUE (user_account_id, device_instance_id)
);

CREATE TABLE IF NOT EXISTS identity.session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE RESTRICT,
  device_trust_record_id uuid REFERENCES identity.device_trust_record(id) ON DELETE SET NULL,
  status identity.session_status NOT NULL DEFAULT 'ACTIVE',
  auth_strength text NOT NULL,
  external_session_reference text,
  session_token_hash text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  CHECK (expires_at > issued_at),
  CHECK (session_token_hash IS NULL OR char_length(session_token_hash) >= 32)
);

CREATE INDEX IF NOT EXISTS identity_active_session_account_idx
  ON identity.session (user_account_id, expires_at)
  WHERE status IN ('ACTIVE','STEP_UP_REQUIRED');

CREATE TABLE IF NOT EXISTS identity.account_recovery_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE RESTRICT,
  state identity.recovery_state NOT NULL DEFAULT 'STARTED',
  claimed_compromised_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  available_trusted_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_outcome text,
  risk_decision text,
  review_owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS identity.account_status_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES identity.user_account(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL,
  command_id uuid NOT NULL,
  CHECK (from_status IS NULL OR from_status IN ('PENDING','ACTIVE','LIMITED','SUSPENDED','CLOSED')),
  CHECK (to_status IN ('PENDING','ACTIVE','LIMITED','SUSPENDED','CLOSED')),
  reason_code text,
  actor_type text NOT NULL,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_id)
);

CREATE OR REPLACE FUNCTION identity.prevent_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS identity_account_status_transition_immutable ON identity.account_status_transition;
CREATE TRIGGER identity_account_status_transition_immutable
BEFORE UPDATE OR DELETE ON identity.account_status_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS identity.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS identity.outbox_message (
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

CREATE INDEX IF NOT EXISTS identity_outbox_unpublished_idx
  ON identity.outbox_message (occurred_at)
  WHERE published_at IS NULL;

COMMENT ON TABLE identity.authenticator IS 'Authentication authority. Passkey private keys are never stored by DAZAT; only verifier/public metadata may be retained.';
COMMENT ON TABLE identity.device_trust_record IS 'Risk/trust context for a recognised device. It is evidence, not permanent identity proof.';
COMMENT ON TABLE identity.session IS 'Revocable session authority. Store only a hash/reference for bearer credentials; never plaintext session secrets.';
COMMENT ON TABLE identity.account_recovery_case IS 'Explicit governed recovery workflow; recovery changes authentication authority, not historical journeys or finance.';
COMMENT ON TABLE identity.contact_point IS 'Typed contact point. Verification state is held separately in verification_record.';
