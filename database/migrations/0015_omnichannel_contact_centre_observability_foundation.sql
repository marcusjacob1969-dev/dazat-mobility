-- DAZAT Mobility — Engineering Phase 0.15
-- Omnichannel policy catalogue, delivery assurance, Contact Centre case continuity,
-- provider health, communications SLO and scenario-simulation truth.
-- No external communications provider or Contact Centre staff mutation is configured.

CREATE TABLE IF NOT EXISTS communications.notification_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  event_type text NOT NULL,
  purpose text NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY','FINANCIAL',
    'COMPLIANCE','SERVICE_OPERATIONAL','ROUTINE','MARKETING'
  )),
  eligible_recipient_roles text[] NOT NULL,
  content_classification text NOT NULL,
  primary_channel text NOT NULL,
  fallback_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  quiet_hours_rule text NOT NULL,
  acknowledgement_required boolean NOT NULL,
  retry_limit integer NOT NULL CHECK (retry_limit >= 0 AND retry_limit <= 20),
  escalation_target text,
  controlled_template_required boolean NOT NULL,
  campaign_user_edit_allowed boolean NOT NULL DEFAULT false,
  marketing_separated_from_operational boolean NOT NULL DEFAULT true CHECK (marketing_separated_from_operational = true),
  current_state_revalidation_required boolean NOT NULL DEFAULT true CHECK (current_state_revalidation_required = true),
  region_code text,
  legal_variant_reference text,
  retention_policy_version text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_key, version),
  CHECK (btrim(policy_key) <> '' AND btrim(event_type) <> '' AND btrim(purpose) <> ''),
  CHECK (cardinality(eligible_recipient_roles) > 0),
  CHECK (fallback_channels <@ ARRAY[
    'IN_APP','PUSH','SMS','EMAIL','PROTECTED_CHAT','MASKED_CALL','AUTOMATED_VOICE',
    'OPERATOR_CALL','PORTAL','LANDLINE','TEXT_RELAY','CARER_OR_RECEPTION'
  ]::text[]),
  CHECK (primary_channel = ANY (ARRAY[
    'IN_APP','PUSH','SMS','EMAIL','PROTECTED_CHAT','MASKED_CALL','AUTOMATED_VOICE',
    'OPERATOR_CALL','PORTAL','LANDLINE','TEXT_RELAY','CARER_OR_RECEPTION'
  ]::text[])),
  CHECK (classification NOT IN ('SAFETY_CRITICAL','SAFEGUARDING','SECURITY') OR (controlled_template_required AND NOT campaign_user_edit_allowed)),
  CHECK (classification <> 'MARKETING' OR campaign_user_edit_allowed),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_notification_policy
  ON communications.notification_policy_version (policy_key, COALESCE(region_code, 'GLOBAL'))
  WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION communications.guard_notification_policy_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.policy_key IS DISTINCT FROM NEW.policy_key
     OR OLD.version IS DISTINCT FROM NEW.version
     OR OLD.event_type IS DISTINCT FROM NEW.event_type
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.classification IS DISTINCT FROM NEW.classification
     OR OLD.eligible_recipient_roles IS DISTINCT FROM NEW.eligible_recipient_roles
     OR OLD.content_classification IS DISTINCT FROM NEW.content_classification
     OR OLD.primary_channel IS DISTINCT FROM NEW.primary_channel
     OR OLD.fallback_channels IS DISTINCT FROM NEW.fallback_channels
     OR OLD.quiet_hours_rule IS DISTINCT FROM NEW.quiet_hours_rule
     OR OLD.acknowledgement_required IS DISTINCT FROM NEW.acknowledgement_required
     OR OLD.retry_limit IS DISTINCT FROM NEW.retry_limit
     OR OLD.escalation_target IS DISTINCT FROM NEW.escalation_target
     OR OLD.controlled_template_required IS DISTINCT FROM NEW.controlled_template_required
     OR OLD.campaign_user_edit_allowed IS DISTINCT FROM NEW.campaign_user_edit_allowed
     OR OLD.marketing_separated_from_operational IS DISTINCT FROM NEW.marketing_separated_from_operational
     OR OLD.current_state_revalidation_required IS DISTINCT FROM NEW.current_state_revalidation_required
     OR OLD.region_code IS DISTINCT FROM NEW.region_code
     OR OLD.legal_variant_reference IS DISTINCT FROM NEW.legal_variant_reference
     OR OLD.retention_policy_version IS DISTINCT FROM NEW.retention_policy_version
     OR OLD.effective_from IS DISTINCT FROM NEW.effective_from
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'NotificationPolicyVersion content is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('SUPERSEDED','REVOKED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'NotificationPolicyVersion only permits one ACTIVE close transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_policy_version_update_guard ON communications.notification_policy_version;
CREATE TRIGGER notification_policy_version_update_guard
BEFORE UPDATE ON communications.notification_policy_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_notification_policy_version_update();
DROP TRIGGER IF EXISTS notification_policy_version_delete_guard ON communications.notification_policy_version;
CREATE TRIGGER notification_policy_version_delete_guard
BEFORE DELETE ON communications.notification_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.delivery_policy_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  classification text NOT NULL CHECK (classification IN (
    'SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY','FINANCIAL',
    'COMPLIANCE','SERVICE_OPERATIONAL','ROUTINE','MARKETING'
  )),
  retry_count integer NOT NULL CHECK (retry_count >= 0 AND retry_count <= 20),
  retry_interval_seconds integer NOT NULL CHECK (retry_interval_seconds >= 0),
  fallback_channel_order text[] NOT NULL DEFAULT ARRAY[]::text[],
  acknowledgement_deadline_seconds integer CHECK (acknowledgement_deadline_seconds IS NULL OR acknowledgement_deadline_seconds > 0),
  escalation_action text,
  repeated_same_channel_hammering_allowed boolean NOT NULL DEFAULT false CHECK (repeated_same_channel_hammering_allowed = false),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_policy_key, version),
  CHECK (btrim(delivery_policy_key) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_delivery_policy
  ON communications.delivery_policy_version (delivery_policy_key) WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION communications.guard_version_close_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(OLD) - 'status' - 'effective_to') IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'effective_to') THEN
    RAISE EXCEPTION 'Versioned communications policy content is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('SUPERSEDED','REVOKED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'Versioned communications policy only permits one ACTIVE close transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_policy_version_update_guard ON communications.delivery_policy_version;
CREATE TRIGGER delivery_policy_version_update_guard
BEFORE UPDATE ON communications.delivery_policy_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS delivery_policy_version_delete_guard ON communications.delivery_policy_version;
CREATE TRIGGER delivery_policy_version_delete_guard
BEFORE DELETE ON communications.delivery_policy_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authoritative_event_id uuid NOT NULL,
  authoritative_event_type text NOT NULL,
  source_aggregate_type text NOT NULL,
  source_aggregate_id uuid NOT NULL,
  source_aggregate_version bigint NOT NULL CHECK (source_aggregate_version > 0),
  current_source_version_at_resolution bigint NOT NULL CHECK (current_source_version_at_resolution > 0),
  notification_policy_version_id uuid NOT NULL REFERENCES communications.notification_policy_version(id) ON DELETE RESTRICT,
  recipient_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  recipient_role text NOT NULL,
  purpose text NOT NULL,
  sensitivity text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('P0','P1','P2','P3','P4')),
  language text,
  accessibility_needs text[] NOT NULL DEFAULT ARRAY[]::text[],
  delivery_deadline timestamptz,
  status text NOT NULL CHECK (status IN ('REQUESTED','POLICY_RESOLVED','SUPPRESSED_STALE','SUPPRESSED_POLICY','COMMUNICATION_CREATED','ESCALATED')),
  communication_id uuid REFERENCES communications.communication(id) ON DELETE RESTRICT,
  authoritative_event_recorded boolean NOT NULL DEFAULT true CHECK (authoritative_event_recorded = true),
  business_state_invented_by_communications boolean NOT NULL DEFAULT false CHECK (business_state_invented_by_communications = false),
  marketing_relabelled_as_operational boolean NOT NULL DEFAULT false CHECK (marketing_relabelled_as_operational = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'SUPPRESSED_STALE' OR source_aggregate_version <> current_source_version_at_resolution),
  CHECK (status NOT IN ('POLICY_RESOLVED','COMMUNICATION_CREATED') OR source_aggregate_version = current_source_version_at_resolution),
  CHECK (status <> 'COMMUNICATION_CREATED' OR communication_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS communication_request_event_recipient_policy_uq
  ON communications.communication_request (authoritative_event_id, recipient_person_id, recipient_role, notification_policy_version_id);

CREATE OR REPLACE FUNCTION communications.guard_communication_request_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.authoritative_event_id IS DISTINCT FROM NEW.authoritative_event_id
     OR OLD.authoritative_event_type IS DISTINCT FROM NEW.authoritative_event_type
     OR OLD.source_aggregate_type IS DISTINCT FROM NEW.source_aggregate_type
     OR OLD.source_aggregate_id IS DISTINCT FROM NEW.source_aggregate_id
     OR OLD.source_aggregate_version IS DISTINCT FROM NEW.source_aggregate_version
     OR OLD.notification_policy_version_id IS DISTINCT FROM NEW.notification_policy_version_id
     OR OLD.recipient_person_id IS DISTINCT FROM NEW.recipient_person_id
     OR OLD.recipient_role IS DISTINCT FROM NEW.recipient_role
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.sensitivity IS DISTINCT FROM NEW.sensitivity
     OR OLD.urgency IS DISTINCT FROM NEW.urgency
     OR OLD.language IS DISTINCT FROM NEW.language
     OR OLD.accessibility_needs IS DISTINCT FROM NEW.accessibility_needs
     OR OLD.delivery_deadline IS DISTINCT FROM NEW.delivery_deadline
     OR OLD.authoritative_event_recorded IS DISTINCT FROM NEW.authoritative_event_recorded
     OR OLD.business_state_invented_by_communications IS DISTINCT FROM NEW.business_state_invented_by_communications
     OR OLD.marketing_relabelled_as_operational IS DISTINCT FROM NEW.marketing_relabelled_as_operational
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'CommunicationRequest authority and recipient truth are immutable';
  END IF;
  IF OLD.status IN ('SUPPRESSED_STALE','SUPPRESSED_POLICY','COMMUNICATION_CREATED','ESCALATED') THEN
    RAISE EXCEPTION 'Terminal CommunicationRequest cannot change';
  END IF;
  IF NOT (
    (OLD.status = 'REQUESTED' AND NEW.status IN ('POLICY_RESOLVED','SUPPRESSED_STALE','SUPPRESSED_POLICY','ESCALATED'))
    OR (OLD.status = 'POLICY_RESOLVED' AND NEW.status IN ('SUPPRESSED_STALE','SUPPRESSED_POLICY','COMMUNICATION_CREATED','ESCALATED'))
  ) THEN
    RAISE EXCEPTION 'Invalid CommunicationRequest transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN RAISE EXCEPTION 'CommunicationRequest updated_at must advance'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communication_request_update_guard ON communications.communication_request;
CREATE TRIGGER communication_request_update_guard
BEFORE UPDATE ON communications.communication_request
FOR EACH ROW EXECUTE FUNCTION communications.guard_communication_request_update();
DROP TRIGGER IF EXISTS communication_request_delete_guard ON communications.communication_request;
CREATE TRIGGER communication_request_delete_guard
BEFORE DELETE ON communications.communication_request
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_policy_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_request_id uuid NOT NULL REFERENCES communications.communication_request(id) ON DELETE RESTRICT,
  notification_policy_version_id uuid NOT NULL REFERENCES communications.notification_policy_version(id) ON DELETE RESTRICT,
  delivery_policy_version_id uuid REFERENCES communications.delivery_policy_version(id) ON DELETE RESTRICT,
  eligible_recipient_role boolean NOT NULL,
  resolved_contact_point_id uuid REFERENCES identity.contact_point(id) ON DELETE RESTRICT,
  permitted_channel_order text[] NOT NULL DEFAULT ARRAY[]::text[],
  override_reason text,
  silent_assistance_do_not_call_preserved boolean NOT NULL DEFAULT true CHECK (silent_assistance_do_not_call_preserved = true),
  current_state_revalidated boolean NOT NULL DEFAULT true CHECK (current_state_revalidated = true),
  resolved_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS communication_policy_resolution_immutable ON communications.communication_policy_resolution;
CREATE TRIGGER communication_policy_resolution_immutable
BEFORE UPDATE OR DELETE ON communications.communication_policy_resolution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.contact_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','WAITING_CUSTOMER','WAITING_INTERNAL','TRANSFER_PENDING','RESOLVED','CLOSED')),
  queue text NOT NULL CHECK (queue IN (
    'SAFETY','SCHOOL_SAFEGUARDING','ACTIVE_JOURNEY','BREAKDOWN','ACCOUNT_SECURITY',
    'DRIVER','ACCESSIBILITY_ASSISTED','PAYMENT','COMPLIANCE_FLEET','ROUTINE_SUPPORT'
  )),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  purpose text NOT NULL,
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  next_action text NOT NULL,
  attention_at timestamptz NOT NULL,
  current_contact_status text NOT NULL CHECK (current_contact_status IN ('REACHABLE','DEGRADED','UNREACHABLE','UNKNOWN')),
  linked_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  linked_journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  linked_canonical_case_type text,
  linked_canonical_case_id uuid,
  correlation_id uuid NOT NULL,
  replaces_canonical_domain_case boolean NOT NULL DEFAULT false CHECK (replaces_canonical_domain_case = false),
  personal_email_or_sms_workaround_used boolean NOT NULL DEFAULT false CHECK (personal_email_or_sms_workaround_used = false),
  channel_history_preserved boolean NOT NULL DEFAULT true CHECK (channel_history_preserved = true),
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  CHECK (btrim(purpose) <> '' AND btrim(next_action) <> ''),
  CHECK (priority NOT IN ('P0','P1') OR owner_person_id IS NOT NULL),
  CHECK (status NOT IN ('RESOLVED','CLOSED') OR resolved_at IS NOT NULL),
  CHECK (status <> 'CLOSED' OR closed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS contact_case_person_timeline_idx
  ON communications.contact_case (person_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS contact_case_queue_attention_idx
  ON communications.contact_case (queue, priority, attention_at)
  WHERE status NOT IN ('RESOLVED','CLOSED');

CREATE OR REPLACE FUNCTION communications.guard_contact_case_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.person_id IS DISTINCT FROM NEW.person_id
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.linked_booking_id IS DISTINCT FROM NEW.linked_booking_id
     OR OLD.linked_journey_id IS DISTINCT FROM NEW.linked_journey_id
     OR OLD.linked_canonical_case_type IS DISTINCT FROM NEW.linked_canonical_case_type
     OR OLD.linked_canonical_case_id IS DISTINCT FROM NEW.linked_canonical_case_id
     OR OLD.correlation_id IS DISTINCT FROM NEW.correlation_id
     OR OLD.replaces_canonical_domain_case IS DISTINCT FROM NEW.replaces_canonical_domain_case
     OR OLD.personal_email_or_sms_workaround_used IS DISTINCT FROM NEW.personal_email_or_sms_workaround_used
     OR OLD.channel_history_preserved IS DISTINCT FROM NEW.channel_history_preserved
     OR OLD.opened_at IS DISTINCT FROM NEW.opened_at THEN
    RAISE EXCEPTION 'ContactCase origin and safety boundaries are immutable';
  END IF;
  IF OLD.status = 'CLOSED' THEN RAISE EXCEPTION 'Closed ContactCase cannot change'; END IF;
  IF NOT (
    OLD.status = NEW.status
    OR (OLD.status = 'OPEN' AND NEW.status IN ('WAITING_CUSTOMER','WAITING_INTERNAL','TRANSFER_PENDING','RESOLVED'))
    OR (OLD.status IN ('WAITING_CUSTOMER','WAITING_INTERNAL') AND NEW.status IN ('OPEN','TRANSFER_PENDING','RESOLVED'))
    OR (OLD.status = 'TRANSFER_PENDING' AND NEW.status IN ('OPEN','WAITING_INTERNAL','RESOLVED'))
    OR (OLD.status = 'RESOLVED' AND NEW.status IN ('OPEN','CLOSED'))
  ) THEN
    RAISE EXCEPTION 'Invalid ContactCase transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.priority IN ('P0','P1') AND NEW.owner_person_id IS NULL THEN
    RAISE EXCEPTION 'High-risk ContactCase cannot remain unowned';
  END IF;
  IF btrim(NEW.next_action) = '' OR NEW.attention_at IS NULL THEN
    RAISE EXCEPTION 'ContactCase next action and attention time are mandatory';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN RAISE EXCEPTION 'ContactCase updated_at must advance'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_case_update_guard ON communications.contact_case;
CREATE TRIGGER contact_case_update_guard
BEFORE UPDATE ON communications.contact_case
FOR EACH ROW EXECUTE FUNCTION communications.guard_contact_case_update();
DROP TRIGGER IF EXISTS contact_case_delete_guard ON communications.contact_case;
CREATE TRIGGER contact_case_delete_guard
BEFORE DELETE ON communications.contact_case
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.contact_case_interaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_case_id uuid NOT NULL REFERENCES communications.contact_case(id) ON DELETE RESTRICT,
  channel text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND','INTERNAL')),
  communication_id uuid REFERENCES communications.communication(id) ON DELETE RESTRICT,
  call_session_id uuid REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  identity_assessment_id uuid REFERENCES communications.caller_identity_assessment(id) ON DELETE RESTRICT,
  permission_state_reference text NOT NULL,
  summary_reference text NOT NULL,
  personal_tool_used boolean NOT NULL DEFAULT false CHECK (personal_tool_used = false),
  personal_contact_data_copied boolean NOT NULL DEFAULT false CHECK (personal_contact_data_copied = false),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communications.contact_case_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_case_id uuid NOT NULL REFERENCES communications.contact_case(id) ON DELETE RESTRICT,
  from_owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  to_owner_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  from_queue text NOT NULL,
  to_queue text NOT NULL,
  reason_code text NOT NULL,
  open_critical_context_present boolean NOT NULL,
  pending_acknowledgements_present boolean NOT NULL,
  degraded_channel_workaround_present boolean NOT NULL,
  channel_history_preserved boolean NOT NULL DEFAULT true CHECK (channel_history_preserved = true),
  transferred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS contact_case_interaction_immutable ON communications.contact_case_interaction;
CREATE TRIGGER contact_case_interaction_immutable
BEFORE UPDATE OR DELETE ON communications.contact_case_interaction
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS contact_case_transfer_immutable ON communications.contact_case_transfer;
CREATE TRIGGER contact_case_transfer_immutable
BEFORE UPDATE OR DELETE ON communications.contact_case_transfer
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_failure_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES communications.communication(id) ON DELETE RESTRICT,
  contact_case_id uuid REFERENCES communications.contact_case(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','FALLBACK_IN_PROGRESS','HUMAN_ESCALATED','RECIPIENT_REACHED','RESOLVED')),
  classification text NOT NULL CHECK (classification IN (
    'SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY','FINANCIAL',
    'COMPLIANCE','SERVICE_OPERATIONAL','ROUTINE','MARKETING'
  )),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2','P3','P4')),
  owner_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  escalation_target text NOT NULL,
  correlation_id uuid NOT NULL,
  contactability text NOT NULL CHECK (contactability IN ('REACHABLE','DEGRADED','UNREACHABLE','UNKNOWN')),
  contactability_is_temporary_context boolean NOT NULL DEFAULT true CHECK (contactability_is_temporary_context = true),
  long_term_personal_rating_created boolean NOT NULL DEFAULT false CHECK (long_term_personal_rating_created = false),
  repeated_same_channel_hammering_allowed boolean NOT NULL DEFAULT false CHECK (repeated_same_channel_hammering_allowed = false),
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (priority NOT IN ('P0','P1') OR owner_person_id IS NOT NULL),
  CHECK (status <> 'RESOLVED' OR resolved_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION communications.guard_communication_failure_case_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.communication_id IS DISTINCT FROM NEW.communication_id
     OR OLD.classification IS DISTINCT FROM NEW.classification
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.escalation_target IS DISTINCT FROM NEW.escalation_target
     OR OLD.correlation_id IS DISTINCT FROM NEW.correlation_id
     OR OLD.contactability_is_temporary_context IS DISTINCT FROM NEW.contactability_is_temporary_context
     OR OLD.long_term_personal_rating_created IS DISTINCT FROM NEW.long_term_personal_rating_created
     OR OLD.repeated_same_channel_hammering_allowed IS DISTINCT FROM NEW.repeated_same_channel_hammering_allowed
     OR OLD.opened_at IS DISTINCT FROM NEW.opened_at THEN
    RAISE EXCEPTION 'CommunicationFailureCase authority truth is immutable';
  END IF;
  IF OLD.status = 'RESOLVED' THEN RAISE EXCEPTION 'Resolved CommunicationFailureCase cannot change'; END IF;
  IF NOT (
    OLD.status = NEW.status
    OR (OLD.status = 'OPEN' AND NEW.status IN ('FALLBACK_IN_PROGRESS','HUMAN_ESCALATED','RECIPIENT_REACHED','RESOLVED'))
    OR (OLD.status = 'FALLBACK_IN_PROGRESS' AND NEW.status IN ('HUMAN_ESCALATED','RECIPIENT_REACHED','RESOLVED'))
    OR (OLD.status = 'HUMAN_ESCALATED' AND NEW.status IN ('RECIPIENT_REACHED','RESOLVED'))
    OR (OLD.status = 'RECIPIENT_REACHED' AND NEW.status = 'RESOLVED')
  ) THEN
    RAISE EXCEPTION 'Invalid CommunicationFailureCase transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.priority IN ('P0','P1') AND NEW.owner_person_id IS NULL THEN
    RAISE EXCEPTION 'Critical communication failure cannot remain unowned';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN RAISE EXCEPTION 'CommunicationFailureCase updated_at must advance'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communication_failure_case_update_guard ON communications.communication_failure_case;
CREATE TRIGGER communication_failure_case_update_guard
BEFORE UPDATE ON communications.communication_failure_case
FOR EACH ROW EXECUTE FUNCTION communications.guard_communication_failure_case_update();
DROP TRIGGER IF EXISTS communication_failure_case_delete_guard ON communications.communication_failure_case;
CREATE TRIGGER communication_failure_case_delete_guard
BEFORE DELETE ON communications.communication_failure_case
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.critical_acknowledgement_requirement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL UNIQUE REFERENCES communications.communication(id) ON DELETE RESTRICT,
  business_dependency text NOT NULL,
  deadline timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('WAITING','ACKNOWLEDGED','DEADLINE_MISSED','ESCALATED')),
  acknowledgement_id uuid REFERENCES communications.communication_acknowledgement(id) ON DELETE RESTRICT,
  failure_case_id uuid REFERENCES communications.communication_failure_case(id) ON DELETE RESTRICT,
  acknowledgement_not_required_for_ordinary_receipt boolean NOT NULL DEFAULT true CHECK (acknowledgement_not_required_for_ordinary_receipt = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(business_dependency) <> ''),
  CHECK (status <> 'ACKNOWLEDGED' OR acknowledgement_id IS NOT NULL),
  CHECK (status <> 'ESCALATED' OR failure_case_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS communications.communication_slo_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  event_family text NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY','FINANCIAL',
    'COMPLIANCE','SERVICE_OPERATIONAL','ROUTINE','MARKETING'
  )),
  region_code text,
  first_attempt_target_seconds integer NOT NULL CHECK (first_attempt_target_seconds > 0),
  delivery_target_seconds integer CHECK (delivery_target_seconds IS NULL OR delivery_target_seconds > 0),
  acknowledgement_target_seconds integer CHECK (acknowledgement_target_seconds IS NULL OR acknowledgement_target_seconds > 0),
  escalation_target_seconds integer NOT NULL CHECK (escalation_target_seconds > 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slo_key, version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_communication_slo
  ON communications.communication_slo_version (slo_key, COALESCE(region_code, 'GLOBAL'))
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS communications.communication_slo_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_slo_version_id uuid NOT NULL REFERENCES communications.communication_slo_version(id) ON DELETE RESTRICT,
  authoritative_event_id uuid NOT NULL,
  communication_id uuid REFERENCES communications.communication(id) ON DELETE RESTRICT,
  channel text NOT NULL,
  region_code text NOT NULL,
  purpose text NOT NULL,
  first_attempt_latency_ms bigint CHECK (first_attempt_latency_ms IS NULL OR first_attempt_latency_ms >= 0),
  delivery_latency_ms bigint CHECK (delivery_latency_ms IS NULL OR delivery_latency_ms >= 0),
  acknowledgement_latency_ms bigint CHECK (acknowledgement_latency_ms IS NULL OR acknowledgement_latency_ms >= 0),
  escalation_latency_ms bigint CHECK (escalation_latency_ms IS NULL OR escalation_latency_ms >= 0),
  provider_accepted boolean NOT NULL,
  delivered boolean NOT NULL,
  read_by_recipient boolean NOT NULL,
  acknowledged boolean NOT NULL,
  sensitive_message_content_included boolean NOT NULL DEFAULT false CHECK (sensitive_message_content_included = false),
  unrestricted_case_drilldown_enabled boolean NOT NULL DEFAULT false CHECK (unrestricted_case_drilldown_enabled = false),
  observed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT read_by_recipient OR delivered),
  CHECK (NOT acknowledged OR delivered)
);

DROP TRIGGER IF EXISTS communication_slo_version_update_guard ON communications.communication_slo_version;
CREATE TRIGGER communication_slo_version_update_guard
BEFORE UPDATE ON communications.communication_slo_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS communication_slo_version_delete_guard ON communications.communication_slo_version;
CREATE TRIGGER communication_slo_version_delete_guard
BEFORE DELETE ON communications.communication_slo_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS communication_slo_observation_immutable ON communications.communication_slo_observation;
CREATE TRIGGER communication_slo_observation_immutable
BEFORE UPDATE OR DELETE ON communications.communication_slo_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.channel_provider_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text NOT NULL UNIQUE,
  channel text NOT NULL,
  region_code text NOT NULL,
  provider_name text NOT NULL DEFAULT 'UNCONFIGURED',
  status text NOT NULL DEFAULT 'UNCONFIGURED' CHECK (status = 'UNCONFIGURED'),
  provider_configured boolean NOT NULL DEFAULT false CHECK (provider_configured = false),
  provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (provider_execution_enabled = false),
  secondary_failover_approved boolean NOT NULL DEFAULT false CHECK (secondary_failover_approved = false),
  privacy_consent_template_audit_rules_bypass_allowed boolean NOT NULL DEFAULT false CHECK (privacy_consent_template_audit_rules_bypass_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(profile_key) <> '' AND btrim(channel) <> '' AND btrim(region_code) <> '')
);

CREATE TABLE IF NOT EXISTS communications.channel_provider_health_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_provider_profile_id uuid REFERENCES communications.channel_provider_profile(id) ON DELETE RESTRICT,
  channel text NOT NULL,
  region_code text NOT NULL,
  purpose text,
  state text NOT NULL CHECK (state IN ('HEALTHY','DEGRADED','PARTIAL_OUTAGE','OUTAGE','RECOVERING','UNKNOWN')),
  queue_depth integer CHECK (queue_depth IS NULL OR queue_depth >= 0),
  failure_rate numeric(5,4) CHECK (failure_rate IS NULL OR (failure_rate >= 0 AND failure_rate <= 1)),
  delivery_latency_ms bigint CHECK (delivery_latency_ms IS NULL OR delivery_latency_ms >= 0),
  callback_backlog integer CHECK (callback_backlog IS NULL OR callback_backlog >= 0),
  fallback_utilisation_rate numeric(5,4) CHECK (fallback_utilisation_rate IS NULL OR (fallback_utilisation_rate >= 0 AND fallback_utilisation_rate <= 1)),
  provider_acceptance_treated_as_delivery boolean NOT NULL DEFAULT false CHECK (provider_acceptance_treated_as_delivery = false),
  observed_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS channel_provider_profile_immutable ON communications.channel_provider_profile;
CREATE TRIGGER channel_provider_profile_immutable
BEFORE UPDATE OR DELETE ON communications.channel_provider_profile
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS channel_provider_health_observation_immutable ON communications.channel_provider_health_observation;
CREATE TRIGGER channel_provider_health_observation_immutable
BEFORE UPDATE OR DELETE ON communications.channel_provider_health_observation
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.provider_outage_response_plan_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  channel text NOT NULL,
  region_code text NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY','FINANCIAL',
    'COMPLIANCE','SERVICE_OPERATIONAL','ROUTINE','MARKETING'
  )),
  outage_action text NOT NULL CHECK (outage_action IN ('DELAY','APPROVED_FAILOVER','HUMAN_CONTINGENCY')),
  approved_alternate_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  silent_assistance_do_not_call_preserved boolean NOT NULL DEFAULT true CHECK (silent_assistance_do_not_call_preserved = true),
  revalidate_before_recovery_release boolean NOT NULL DEFAULT true CHECK (revalidate_before_recovery_release = true),
  stale_replay_allowed boolean NOT NULL DEFAULT false CHECK (stale_replay_allowed = false),
  duplicate_replay_allowed boolean NOT NULL DEFAULT false CHECK (duplicate_replay_allowed = false),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_key, version),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_provider_outage_response_plan
  ON communications.provider_outage_response_plan_version (plan_key) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS communications.communications_scenario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  event_family text NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY','FINANCIAL',
    'COMPLIANCE','SERVICE_OPERATIONAL','ROUTINE','MARKETING'
  )),
  scenario_type text NOT NULL CHECK (scenario_type IN (
    'BOOKING','REASSIGNMENT','BREAKDOWN','SCHOOL_HANDOVER','PAYMENT_STATUS_UNKNOWN',
    'PAYOUT_DESTINATION_CHANGE','TELEPHONY_OUTAGE','SMS_OUTAGE'
  )),
  required_outcomes text[] NOT NULL,
  real_user_contact_allowed boolean NOT NULL DEFAULT false CHECK (real_user_contact_allowed = false),
  approved_fixture_only boolean NOT NULL DEFAULT true CHECK (approved_fixture_only = true),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_key, version),
  CHECK (required_outcomes @> ARRAY[
    'PRIMARY_SUCCESS','PRIMARY_FAILURE','FALLBACK_SUCCESS','ALL_CHANNEL_FAILURE',
    'STALE_EVENT','DUPLICATE_EVENT','OUT_OF_ORDER_EVENT'
  ]::text[] OR classification NOT IN ('SAFETY_CRITICAL','SAFEGUARDING','ACTIVE_JOURNEY','SECURITY'))
);

DROP TRIGGER IF EXISTS provider_outage_response_plan_version_update_guard ON communications.provider_outage_response_plan_version;
CREATE TRIGGER provider_outage_response_plan_version_update_guard
BEFORE UPDATE ON communications.provider_outage_response_plan_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS provider_outage_response_plan_version_delete_guard ON communications.provider_outage_response_plan_version;
CREATE TRIGGER provider_outage_response_plan_version_delete_guard
BEFORE DELETE ON communications.provider_outage_response_plan_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_scenario_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communications_scenario_id uuid NOT NULL REFERENCES communications.communications_scenario(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('CREATED','RUNNING','PASSED','FAILED','ABORTED')),
  fixture_set_reference text NOT NULL,
  contacted_real_users boolean NOT NULL DEFAULT false CHECK (contacted_real_users = false),
  external_provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_provider_execution_enabled = false),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('PASSED','FAILED','ABORTED') OR completed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS communications.communications_scenario_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communications_scenario_run_id uuid NOT NULL REFERENCES communications.communications_scenario_run(id) ON DELETE RESTRICT,
  outcome_type text NOT NULL CHECK (outcome_type IN (
    'PRIMARY_SUCCESS','PRIMARY_FAILURE','FALLBACK_SUCCESS','ALL_CHANNEL_FAILURE',
    'STALE_EVENT','DUPLICATE_EVENT','OUT_OF_ORDER_EVENT','TEMPLATE_SAFETY','ACCESSIBILITY_ROUTE'
  )),
  passed boolean NOT NULL,
  evidence_reference text NOT NULL,
  leaked_internal_id boolean NOT NULL DEFAULT false CHECK (leaked_internal_id = false),
  unsupported_guarantee_present boolean NOT NULL DEFAULT false CHECK (unsupported_guarantee_present = false),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS communications_scenario_immutable ON communications.communications_scenario;
CREATE TRIGGER communications_scenario_immutable
BEFORE UPDATE OR DELETE ON communications.communications_scenario
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS communications_scenario_result_immutable ON communications.communications_scenario_result;
CREATE TRIGGER communications_scenario_result_immutable
BEFORE UPDATE OR DELETE ON communications.communications_scenario_result
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION communications.guard_critical_acknowledgement_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.communication_id IS DISTINCT FROM NEW.communication_id
     OR OLD.business_dependency IS DISTINCT FROM NEW.business_dependency
     OR OLD.deadline IS DISTINCT FROM NEW.deadline
     OR OLD.acknowledgement_not_required_for_ordinary_receipt IS DISTINCT FROM NEW.acknowledgement_not_required_for_ordinary_receipt
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'CriticalAcknowledgementRequirement origin is immutable';
  END IF;
  IF OLD.status IN ('ACKNOWLEDGED','ESCALATED') THEN
    RAISE EXCEPTION 'Terminal CriticalAcknowledgementRequirement cannot change';
  END IF;
  IF NOT (
    (OLD.status = 'WAITING' AND NEW.status IN ('ACKNOWLEDGED','DEADLINE_MISSED','ESCALATED'))
    OR (OLD.status = 'DEADLINE_MISSED' AND NEW.status = 'ESCALATED')
  ) THEN
    RAISE EXCEPTION 'Invalid CriticalAcknowledgementRequirement transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN RAISE EXCEPTION 'CriticalAcknowledgementRequirement updated_at must advance'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS critical_acknowledgement_update_guard ON communications.critical_acknowledgement_requirement;
CREATE TRIGGER critical_acknowledgement_update_guard
BEFORE UPDATE ON communications.critical_acknowledgement_requirement
FOR EACH ROW EXECUTE FUNCTION communications.guard_critical_acknowledgement_update();
DROP TRIGGER IF EXISTS critical_acknowledgement_delete_guard ON communications.critical_acknowledgement_requirement;
CREATE TRIGGER critical_acknowledgement_delete_guard
BEFORE DELETE ON communications.critical_acknowledgement_requirement
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE OR REPLACE FUNCTION communications.guard_scenario_run_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.communications_scenario_id IS DISTINCT FROM NEW.communications_scenario_id
     OR OLD.fixture_set_reference IS DISTINCT FROM NEW.fixture_set_reference
     OR OLD.contacted_real_users IS DISTINCT FROM NEW.contacted_real_users
     OR OLD.external_provider_execution_enabled IS DISTINCT FROM NEW.external_provider_execution_enabled
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'CommunicationsScenarioRun fixture and execution truth are immutable';
  END IF;
  IF OLD.status IN ('PASSED','FAILED','ABORTED') THEN RAISE EXCEPTION 'Terminal CommunicationsScenarioRun cannot change'; END IF;
  IF NOT (
    (OLD.status = 'CREATED' AND NEW.status IN ('RUNNING','ABORTED'))
    OR (OLD.status = 'RUNNING' AND NEW.status IN ('PASSED','FAILED','ABORTED'))
  ) THEN
    RAISE EXCEPTION 'Invalid CommunicationsScenarioRun transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communications_scenario_run_update_guard ON communications.communications_scenario_run;
CREATE TRIGGER communications_scenario_run_update_guard
BEFORE UPDATE ON communications.communications_scenario_run
FOR EACH ROW EXECUTE FUNCTION communications.guard_scenario_run_update();
DROP TRIGGER IF EXISTS communications_scenario_run_delete_guard ON communications.communications_scenario_run;
CREATE TRIGGER communications_scenario_run_delete_guard
BEFORE DELETE ON communications.communications_scenario_run
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_operations_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'NOTIFICATION_POLICY_RESOLVED','DELIVERY_ATTEMPTED','DELIVERY_FAILED','DELIVERY_ACKNOWLEDGED',
    'FALLBACK_STARTED','CRITICAL_RECIPIENT_UNREACHABLE','CONTACT_CASE_OPENED','CONTACT_CASE_TRANSFERRED',
    'CHANNEL_OUTAGE_DETECTED','CHANNEL_RECOVERED','STALE_RECOVERY_MESSAGE_DISCARDED'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensitive_message_content_included boolean NOT NULL DEFAULT false CHECK (sensitive_message_content_included = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS communications_operations_event_immutable ON communications.communications_operations_event;
CREATE TRIGGER communications_operations_event_immutable
BEFORE UPDATE OR DELETE ON communications.communications_operations_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_operations_command_deduplication (
  command_id uuid PRIMARY KEY,
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, idempotency_key)
);

DROP TRIGGER IF EXISTS communications_operations_command_deduplication_immutable ON communications.communications_operations_command_deduplication;
CREATE TRIGGER communications_operations_command_deduplication_immutable
BEFORE UPDATE OR DELETE ON communications.communications_operations_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_operations_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  external_provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_provider_execution_enabled = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS communications_operations_outbox_unpublished_idx
  ON communications.communications_operations_outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE communications.notification_policy_version IS 'Versioned event/role/channel policy; Communications never invents canonical business state.';
COMMENT ON TABLE communications.contact_case IS 'Shared human-service container that preserves channel history and links to, but never replaces, canonical domain cases.';
COMMENT ON TABLE communications.communication_failure_case IS 'Critical delivery failure becomes owned operational work, never merely a provider log or personal rating.';
COMMENT ON TABLE communications.communication_slo_observation IS 'Purpose/region/channel reliability evidence without sensitive message-content surveillance.';
COMMENT ON TABLE communications.communications_scenario_run IS 'Provider-disabled approved-fixture simulation that never contacts real users.';
