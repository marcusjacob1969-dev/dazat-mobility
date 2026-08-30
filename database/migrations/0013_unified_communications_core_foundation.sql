-- DAZAT Mobility — Engineering Phase 0.13
-- Unified Communications Core: governed purpose, recipients, templates, routing, delivery,
-- acknowledgement, protected contact, stale suppression and explicit provider health.
-- No external SMS, email, push, telephony or chat provider is configured by this checkpoint.

CREATE TABLE IF NOT EXISTS communications.communication_template_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  purpose text NOT NULL CHECK (purpose IN (
    'BOOKING_OPERATIONAL','JOURNEY_OPERATIONAL','SAFETY','SCHOOL_SAFEGUARDING','PAYMENT',
    'ACCOUNT_SECURITY','DRIVER_OPERATIONS','SUPPORT','BUSINESS','MARKETING'
  )),
  locale text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  content_reference text NOT NULL,
  critical_template boolean NOT NULL,
  asks_for_password boolean NOT NULL DEFAULT false CHECK (asks_for_password = false),
  asks_for_full_pin boolean NOT NULL DEFAULT false CHECK (asks_for_full_pin = false),
  asks_for_otp boolean NOT NULL DEFAULT false CHECK (asks_for_otp = false),
  asks_for_device_linking_code boolean NOT NULL DEFAULT false CHECK (asks_for_device_linking_code = false),
  approved_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, version, locale),
  CHECK (btrim(template_key) <> '' AND btrim(locale) <> '' AND btrim(content_reference) <> ''),
  CHECK (
    (status = 'APPROVED' AND approved_by_person_id IS NOT NULL AND approved_at IS NOT NULL)
    OR status <> 'APPROVED'
  )
);

DROP TRIGGER IF EXISTS communication_template_version_immutable ON communications.communication_template_version;
CREATE TRIGGER communication_template_version_immutable
BEFORE UPDATE OR DELETE ON communications.communication_template_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_preference_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  purpose text NOT NULL CHECK (purpose IN (
    'BOOKING_OPERATIONAL','JOURNEY_OPERATIONAL','SAFETY','SCHOOL_SAFEGUARDING','PAYMENT',
    'ACCOUNT_SECURITY','DRIVER_OPERATIONS','SUPPORT','BUSINESS','MARKETING'
  )),
  preferred_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  blocked_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  locale text NOT NULL DEFAULT 'en-GB',
  quiet_hours_start time,
  quiet_hours_end time,
  marketing_consent_granted boolean NOT NULL DEFAULT false,
  marketing_consent_reference text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, version, purpose),
  CHECK (preferred_channels <@ ARRAY['IN_APP','PUSH','SMS','EMAIL','VOICE_CALL','MASKED_CALL','PROTECTED_CHAT','AUTHENTICATED_PORTAL']::text[]),
  CHECK (blocked_channels <@ ARRAY['IN_APP','PUSH','SMS','EMAIL','VOICE_CALL','MASKED_CALL','PROTECTED_CHAT','AUTHENTICATED_PORTAL']::text[]),
  CHECK (NOT preferred_channels && blocked_channels),
  CHECK ((quiet_hours_start IS NULL) = (quiet_hours_end IS NULL)),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (
    purpose <> 'MARKETING'
    OR NOT marketing_consent_granted
    OR marketing_consent_reference IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS communications_one_current_preference_per_purpose
  ON communications.communication_preference_version (person_id, purpose)
  WHERE effective_to IS NULL;

CREATE OR REPLACE FUNCTION communications.guard_preference_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.person_id IS DISTINCT FROM NEW.person_id
     OR OLD.version IS DISTINCT FROM NEW.version
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.preferred_channels IS DISTINCT FROM NEW.preferred_channels
     OR OLD.blocked_channels IS DISTINCT FROM NEW.blocked_channels
     OR OLD.locale IS DISTINCT FROM NEW.locale
     OR OLD.quiet_hours_start IS DISTINCT FROM NEW.quiet_hours_start
     OR OLD.quiet_hours_end IS DISTINCT FROM NEW.quiet_hours_end
     OR OLD.marketing_consent_granted IS DISTINCT FROM NEW.marketing_consent_granted
     OR OLD.marketing_consent_reference IS DISTINCT FROM NEW.marketing_consent_reference
     OR OLD.effective_from IS DISTINCT FROM NEW.effective_from
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'CommunicationPreferenceVersion truth is immutable';
  END IF;
  IF OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'CommunicationPreferenceVersion may only be closed once with a valid effective_to';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communication_preference_version_guard ON communications.communication_preference_version;
CREATE TRIGGER communication_preference_version_guard
BEFORE UPDATE ON communications.communication_preference_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_preference_version_update();
DROP TRIGGER IF EXISTS communication_preference_version_delete_guard ON communications.communication_preference_version;
CREATE TRIGGER communication_preference_version_delete_guard
BEFORE DELETE ON communications.communication_preference_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN (
    'BOOKING_OPERATIONAL','JOURNEY_OPERATIONAL','SAFETY','SCHOOL_SAFEGUARDING','PAYMENT',
    'ACCOUNT_SECURITY','DRIVER_OPERATIONS','SUPPORT','BUSINESS','MARKETING'
  )),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  recipient_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  recipient_role text NOT NULL,
  template_key text NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  locale text NOT NULL DEFAULT 'en-GB',
  source_aggregate_type text NOT NULL,
  source_aggregate_id uuid NOT NULL,
  source_aggregate_version bigint NOT NULL CHECK (source_aggregate_version > 0),
  status text NOT NULL CHECK (status IN (
    'QUEUED','DELIVERY_PENDING','DELIVERED','ACK_REQUIRED','ACKNOWLEDGED','FAILED','EXPIRED','SUPPRESSED'
  )),
  suppression_reason text CHECK (suppression_reason IN (
    'SOURCE_VERSION_STALE','EXPIRED','NO_MARKETING_CONSENT','NO_SAFE_CHANNEL','TEMPLATE_UNAVAILABLE'
  )),
  acknowledgement_required boolean NOT NULL DEFAULT false,
  acknowledgement_deadline timestamptz,
  expires_at timestamptz,
  marketing_relabelled_as_operational boolean NOT NULL DEFAULT false CHECK (marketing_relabelled_as_operational = false),
  personal_contact_details_exposed boolean NOT NULL DEFAULT false CHECK (personal_contact_details_exposed = false),
  external_provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_provider_execution_enabled = false),
  created_by_service text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(recipient_role) <> '' AND btrim(template_key) <> '' AND btrim(source_aggregate_type) <> ''),
  CHECK ((status = 'SUPPRESSED') = (suppression_reason IS NOT NULL)),
  CHECK (NOT acknowledgement_required OR acknowledgement_deadline IS NOT NULL),
  CHECK (acknowledgement_deadline IS NULL OR acknowledgement_deadline > created_at),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS communications_recipient_inbox_idx
  ON communications.communication (recipient_person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS communications_source_currentness_idx
  ON communications.communication (source_aggregate_type, source_aggregate_id, source_aggregate_version);

CREATE OR REPLACE FUNCTION communications.guard_communication_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.recipient_person_id IS DISTINCT FROM NEW.recipient_person_id
     OR OLD.recipient_role IS DISTINCT FROM NEW.recipient_role
     OR OLD.template_key IS DISTINCT FROM NEW.template_key
     OR OLD.template_version IS DISTINCT FROM NEW.template_version
     OR OLD.locale IS DISTINCT FROM NEW.locale
     OR OLD.source_aggregate_type IS DISTINCT FROM NEW.source_aggregate_type
     OR OLD.source_aggregate_id IS DISTINCT FROM NEW.source_aggregate_id
     OR OLD.source_aggregate_version IS DISTINCT FROM NEW.source_aggregate_version
     OR OLD.acknowledgement_required IS DISTINCT FROM NEW.acknowledgement_required
     OR OLD.acknowledgement_deadline IS DISTINCT FROM NEW.acknowledgement_deadline
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
     OR OLD.marketing_relabelled_as_operational IS DISTINCT FROM NEW.marketing_relabelled_as_operational
     OR OLD.personal_contact_details_exposed IS DISTINCT FROM NEW.personal_contact_details_exposed
     OR OLD.external_provider_execution_enabled IS DISTINCT FROM NEW.external_provider_execution_enabled
     OR OLD.created_by_service IS DISTINCT FROM NEW.created_by_service
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Communication identity, purpose, recipient, source and policy truth are immutable';
  END IF;
  IF NOT (
    (OLD.status = 'QUEUED' AND NEW.status IN ('DELIVERY_PENDING','SUPPRESSED','EXPIRED','FAILED'))
    OR (OLD.status = 'DELIVERY_PENDING' AND NEW.status IN ('DELIVERED','ACK_REQUIRED','SUPPRESSED','EXPIRED','FAILED'))
    OR (OLD.status = 'DELIVERED' AND NEW.status IN ('ACK_REQUIRED','EXPIRED'))
    OR (OLD.status = 'ACK_REQUIRED' AND NEW.status IN ('ACKNOWLEDGED','EXPIRED','FAILED'))
  ) THEN
    RAISE EXCEPTION 'Invalid Communication transition % -> %', OLD.status, NEW.status;
  END IF;
  IF (NEW.status = 'SUPPRESSED') <> (NEW.suppression_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'Communication suppression requires one explicit reason';
  END IF;
  IF NEW.status <> 'SUPPRESSED' AND OLD.suppression_reason IS DISTINCT FROM NEW.suppression_reason THEN
    RAISE EXCEPTION 'Communication suppression reason may change only when suppressing';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'Communication updated_at must advance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communication_update_guard ON communications.communication;
CREATE TRIGGER communication_update_guard
BEFORE UPDATE ON communications.communication
FOR EACH ROW EXECUTE FUNCTION communications.guard_communication_update();
DROP TRIGGER IF EXISTS communication_delete_guard ON communications.communication;
CREATE TRIGGER communication_delete_guard
BEFORE DELETE ON communications.communication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES communications.communication(id) ON DELETE RESTRICT,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN (
    'QUEUED','DELIVERY_PENDING','DELIVERED','ACK_REQUIRED','ACKNOWLEDGED','FAILED','EXPIRED','SUPPRESSED'
  )),
  reason_code text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(reason_code) <> '' AND btrim(actor_type) <> '')
);

DROP TRIGGER IF EXISTS communication_status_event_immutable ON communications.communication_status_event;
CREATE TRIGGER communication_status_event_immutable
BEFORE UPDATE OR DELETE ON communications.communication_status_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_delivery_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL UNIQUE REFERENCES communications.communication(id) ON DELETE RESTRICT,
  route_state text NOT NULL CHECK (route_state IN (
    'ROUTABLE','DEFERRED_QUIET_HOURS','SUPPRESSED_NO_CONSENT','NO_SAFE_CHANNEL'
  )),
  planned_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  fallback_required boolean NOT NULL,
  fallback_policy_version text NOT NULL,
  silent_assistance boolean NOT NULL DEFAULT false,
  voice_or_auto_call_allowed boolean NOT NULL,
  compromised_channels_excluded boolean NOT NULL DEFAULT true CHECK (compromised_channels_excluded = true),
  provider_execution_authorised boolean NOT NULL DEFAULT false CHECK (provider_execution_authorised = false),
  planned_at timestamptz NOT NULL DEFAULT now(),
  CHECK (planned_channels <@ ARRAY['IN_APP','PUSH','SMS','EMAIL','VOICE_CALL','MASKED_CALL','PROTECTED_CHAT','AUTHENTICATED_PORTAL']::text[]),
  CHECK (NOT silent_assistance OR NOT voice_or_auto_call_allowed),
  CHECK (btrim(fallback_policy_version) <> '')
);

DROP TRIGGER IF EXISTS communication_delivery_plan_immutable ON communications.communication_delivery_plan;
CREATE TRIGGER communication_delivery_plan_immutable
BEFORE UPDATE OR DELETE ON communications.communication_delivery_plan
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.message_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES communications.communication(id) ON DELETE RESTRICT,
  channel text NOT NULL CHECK (channel IN (
    'IN_APP','PUSH','SMS','EMAIL','VOICE_CALL','MASKED_CALL','PROTECTED_CHAT','AUTHENTICATED_PORTAL'
  )),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  contact_point_id uuid REFERENCES identity.contact_point(id) ON DELETE RESTRICT,
  contact_hint text,
  state text NOT NULL CHECK (state IN (
    'QUEUED','SENT','DELIVERED','READ','FAILED','EXPIRED','UNKNOWN','SUPPRESSED_STALE'
  )),
  provider_reference text,
  failure_code text,
  source_version_revalidated boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_id, channel, attempt_number),
  CHECK (contact_hint IS NULL OR length(contact_hint) <= 100),
  CHECK (state <> 'SUPPRESSED_STALE' OR source_version_revalidated),
  CHECK (state NOT IN ('SENT','DELIVERED','READ') OR provider_reference IS NOT NULL)
);

DROP TRIGGER IF EXISTS message_delivery_immutable ON communications.message_delivery;
CREATE TRIGGER message_delivery_immutable
BEFORE UPDATE OR DELETE ON communications.message_delivery
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_acknowledgement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES communications.communication(id) ON DELETE RESTRICT,
  recipient_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  client_acknowledgement_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_person_id, client_acknowledgement_id),
  UNIQUE (communication_id, recipient_person_id)
);

DROP TRIGGER IF EXISTS communication_acknowledgement_immutable ON communications.communication_acknowledgement;
CREATE TRIGGER communication_acknowledgement_immutable
BEFORE UPDATE OR DELETE ON communications.communication_acknowledgement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.protected_conversation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  linked_aggregate_type text NOT NULL,
  linked_aggregate_id uuid NOT NULL,
  participant_person_ids uuid[] NOT NULL,
  status text NOT NULL CHECK (status IN ('SCHEDULED','ACTIVE','EXPIRED','CLOSED')),
  opens_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  personal_contact_details_exposed boolean NOT NULL DEFAULT false CHECK (personal_contact_details_exposed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > opens_at),
  CHECK (cardinality(participant_person_ids) >= 2),
  CHECK (btrim(purpose) <> '' AND btrim(linked_aggregate_type) <> '')
);

CREATE TABLE IF NOT EXISTS communications.masked_call_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protected_conversation_id uuid NOT NULL REFERENCES communications.protected_conversation(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('SCHEDULED','ACTIVE','ENDED','EXPIRED','FAILED')),
  provider_reference text,
  opens_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  personal_numbers_disclosed boolean NOT NULL DEFAULT false CHECK (personal_numbers_disclosed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > opens_at)
);

CREATE TABLE IF NOT EXISTS communications.channel_health_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN (
    'IN_APP','PUSH','SMS','EMAIL','VOICE_CALL','MASKED_CALL','PROTECTED_CHAT','AUTHENTICATED_PORTAL'
  )),
  state text NOT NULL CHECK (state IN ('HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN')),
  source_reference text NOT NULL,
  observed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > observed_at),
  CHECK (btrim(source_reference) <> ''),
  CHECK (jsonb_typeof(details) = 'object')
);

DROP TRIGGER IF EXISTS channel_health_observation_immutable ON communications.channel_health_observation;
CREATE TRIGGER channel_health_observation_immutable
BEFORE UPDATE OR DELETE ON communications.channel_health_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE VIEW communications.current_channel_health AS
SELECT channel,
       CASE WHEN expires_at <= now() THEN 'UNKNOWN' ELSE state END AS state,
       observed_at,
       expires_at,
       source_reference
  FROM (
    SELECT observation.*,
           row_number() OVER (PARTITION BY channel ORDER BY observed_at DESC, id DESC) AS row_number
      FROM communications.channel_health_observation observation
  ) latest
 WHERE row_number = 1;

CREATE TABLE IF NOT EXISTS communications.communication_command_deduplication (
  command_id uuid PRIMARY KEY,
  command_type text NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, actor_person_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS communications.communication_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'communications.communication-requested',
    'communications.communication-suppressed',
    'communications.delivery-observed',
    'communications.acknowledgement-recorded',
    'communications.acknowledgement-escalation-required'
  )),
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS communication_outbox_unpublished_idx
  ON communications.communication_outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE communications.communication IS 'Purpose-scoped communication intent, separate from every channel delivery attempt.';
COMMENT ON TABLE communications.message_delivery IS 'Append-only delivery observation. UNKNOWN is retained and never treated as delivered.';
COMMENT ON TABLE communications.communication_delivery_plan IS 'Safe route/fallback plan with all external provider execution disabled at Phase 0.13.';
COMMENT ON TABLE communications.protected_conversation IS 'Time-bounded contact without exposing participant personal contact details.';
