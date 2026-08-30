-- DAZAT Mobility — Engineering Phase 0.16
-- Communications Engine final closure: canonical request/envelope, permission resolution,
-- ordered routing, degraded-mode, acceptance and launch-gate truth.
-- This migration enables no external provider, staff command or production scenario execution.

CREATE TABLE IF NOT EXISTS communications.canonical_event_envelope (
  event_id uuid PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type ~ '\.v[1-9][0-9]*$'),
  source_domain text NOT NULL CHECK (source_domain IN (
    'BOOKING','JOURNEY','SAFETY','SCHOOL','FINANCE','DRIVER','FLEET',
    'SUPPORT','SHIELD','SYSTEM','BUSINESS'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  region_code text NOT NULL,
  service_context text NOT NULL,
  classification text NOT NULL CHECK (classification IN (
    'PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','HIGHLY_RESTRICTED'
  )),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload_schema_version integer NOT NULL CHECK (payload_schema_version > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_schema_supported boolean NOT NULL DEFAULT true CHECK (payload_schema_supported = true),
  sensitive_message_content_included boolean NOT NULL DEFAULT false CHECK (sensitive_message_content_included = false),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(event_type) <> '' AND btrim(aggregate_type) <> ''),
  CHECK (btrim(region_code) <> '' AND btrim(service_context) <> ''),
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS canonical_event_envelope_immutable ON communications.canonical_event_envelope;
CREATE TRIGGER canonical_event_envelope_immutable
BEFORE UPDATE OR DELETE ON communications.canonical_event_envelope
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_event_contract_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'DriverAssigned.v1','DriverArrived.v1','RideCheckMismatch.v1',
    'PassengerOnboardBreakdown.v1','ReplacementDriverAssigned.v1','SafetySOS.v1',
    'SilentAssistance.v1','SchoolHandoverFailed.v1','PaymentStatusUnknown.v1',
    'PayoutDestinationChanged.v1','VehicleDoNotUse.v1','ContactPointChanged.v1',
    'AccountRecoveryStarted.v1','CommunicationsChannelOutage.v1'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  source_domain text NOT NULL,
  recipient_roles text[] NOT NULL,
  default_handling text NOT NULL,
  hard_rule text NOT NULL,
  current_state_revalidation_required boolean NOT NULL DEFAULT true CHECK (current_state_revalidation_required = true),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, version),
  CHECK (cardinality(recipient_roles) > 0),
  CHECK (btrim(source_domain) <> '' AND btrim(default_handling) <> '' AND btrim(hard_rule) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_communication_event_contract
  ON communications.communication_event_contract_version (event_type) WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS communication_event_contract_version_update_guard ON communications.communication_event_contract_version;
CREATE TRIGGER communication_event_contract_version_update_guard
BEFORE UPDATE ON communications.communication_event_contract_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS communication_event_contract_version_delete_guard ON communications.communication_event_contract_version;
CREATE TRIGGER communication_event_contract_version_delete_guard
BEFORE DELETE ON communications.communication_event_contract_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_api_contract_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key text NOT NULL CHECK (operation_key IN (
    'POST /communications','POST /communications/{id}/acknowledge',
    'GET /communications/{id}/status','GET/PUT /communication-preferences',
    'POST /contact-points/verify','POST /contact-points/change',
    'POST /conversations','POST /calls/masked','POST /telephone/sessions',
    'POST /voice/dialogues','POST /account-recovery',
    'POST /account-recovery/{id}/evidence','POST /account-recovery/{id}/complete',
    'POST /communications/security/restrict-channel','GET /communications/channel-health'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  command_name text NOT NULL,
  owning_backend text NOT NULL,
  contract_description text NOT NULL,
  implementation_state text NOT NULL CHECK (implementation_state IN ('CATALOGUED','READ_ONLY_IMPLEMENTED','DISABLED')),
  endpoint_call_grants_domain_authority boolean NOT NULL DEFAULT false CHECK (endpoint_call_grants_domain_authority = false),
  external_provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_provider_execution_enabled = false),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_key, version),
  CHECK (btrim(command_name) <> '' AND btrim(owning_backend) <> '' AND btrim(contract_description) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_communication_api_contract
  ON communications.communication_api_contract_version (operation_key) WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS communication_api_contract_version_update_guard ON communications.communication_api_contract_version;
CREATE TRIGGER communication_api_contract_version_update_guard
BEFORE UPDATE ON communications.communication_api_contract_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS communication_api_contract_version_delete_guard ON communications.communication_api_contract_version;
CREATE TRIGGER communication_api_contract_version_delete_guard
BEFORE DELETE ON communications.communication_api_contract_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_p0_requirement_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_key text NOT NULL CHECK (requirement_key IN (
    'COM-CORE-001','COM-CORE-002','COM-CORE-003','COM-DEL-001','COM-DEL-002','COM-DEL-003',
    'COM-TEL-001','COM-TEL-002','COM-VOI-001','COM-SEC-001','COM-SEC-002','COM-SEC-003',
    'COM-SAF-001','COM-SCH-001','COM-FIN-001','COM-PRV-001','COM-PRV-002','COM-RES-001',
    'COM-AUD-001','COM-ACC-001'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  requirement_statement text NOT NULL,
  evidence_reference text,
  source_verified boolean NOT NULL DEFAULT false,
  production_verified boolean NOT NULL DEFAULT false CHECK (production_verified = false),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_key, version),
  CHECK (btrim(requirement_statement) <> ''),
  CHECK (NOT source_verified OR evidence_reference IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_communication_p0_requirement
  ON communications.communication_p0_requirement_version (requirement_key) WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS communication_p0_requirement_version_update_guard ON communications.communication_p0_requirement_version;
CREATE TRIGGER communication_p0_requirement_version_update_guard
BEFORE UPDATE ON communications.communication_p0_requirement_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS communication_p0_requirement_version_delete_guard ON communications.communication_p0_requirement_version;
CREATE TRIGGER communication_p0_requirement_version_delete_guard
BEFORE DELETE ON communications.communication_p0_requirement_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_request_contract (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_request_id uuid NOT NULL UNIQUE REFERENCES communications.communication_request(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  source_domain text NOT NULL CHECK (source_domain IN (
    'BOOKING','JOURNEY','SAFETY','SCHOOL','FINANCE','DRIVER','FLEET',
    'SUPPORT','SHIELD','SYSTEM','BUSINESS'
  )),
  source_event_id uuid NOT NULL REFERENCES communications.canonical_event_envelope(event_id) ON DELETE RESTRICT,
  recipient_ref text NOT NULL,
  template_id text NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  approved_payload_variables jsonb NOT NULL,
  payload_contains_arbitrary_source_object boolean NOT NULL DEFAULT false CHECK (payload_contains_arbitrary_source_object = false),
  state_version bigint NOT NULL CHECK (state_version > 0),
  current_state_version_at_resolution bigint NOT NULL CHECK (current_state_version_at_resolution > 0),
  classification text NOT NULL CHECK (classification IN (
    'PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','HIGHLY_RESTRICTED'
  )),
  acknowledgement_policy_ref text NOT NULL,
  fallback_policy_version_id uuid NOT NULL REFERENCES communications.delivery_policy_version(id) ON DELETE RESTRICT,
  correlation_id uuid NOT NULL,
  priority_grants_additional_data_access boolean NOT NULL DEFAULT false CHECK (priority_grants_additional_data_access = false),
  raw_contact_accepted_from_source_domain boolean NOT NULL DEFAULT false CHECK (raw_contact_accepted_from_source_domain = false),
  business_state_invented_by_communications boolean NOT NULL DEFAULT false CHECK (business_state_invented_by_communications = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_domain, idempotency_key),
  CHECK (btrim(idempotency_key) <> '' AND btrim(recipient_ref) <> ''),
  CHECK (btrim(template_id) <> '' AND btrim(acknowledgement_policy_ref) <> ''),
  CHECK (jsonb_typeof(approved_payload_variables) = 'array'),
  CHECK (jsonb_array_length(approved_payload_variables) > 0)
);

DROP TRIGGER IF EXISTS communication_request_contract_immutable ON communications.communication_request_contract;
CREATE TRIGGER communication_request_contract_immutable
BEFORE UPDATE OR DELETE ON communications.communication_request_contract
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.recipient_permission_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_request_id uuid NOT NULL REFERENCES communications.communication_request(id) ON DELETE RESTRICT,
  recipient_role text NOT NULL CHECK (recipient_role IN (
    'PASSENGER','BOOKER','PAYER','GUARDIAN_CARER','SCHOOL_CONTACT','DRIVER',
    'BUSINESS_AUTHORITY_CONTACT','CONTROL_ROOM_OPERATOR','SAFETY_OPERATOR','PARTNER_RESCUE_PROVIDER'
  )),
  permission_basis text NOT NULL,
  active_task_reference text,
  allowed_field_names text[] NOT NULL,
  excluded_field_names text[] NOT NULL DEFAULT ARRAY[]::text[],
  minimum_necessary_payload boolean NOT NULL DEFAULT true CHECK (minimum_necessary_payload = true),
  unrestricted_relationship_visibility_granted boolean NOT NULL DEFAULT false CHECK (unrestricted_relationship_visibility_granted = false),
  internal_case_notes_included boolean NOT NULL DEFAULT false CHECK (internal_case_notes_included = false),
  permitted boolean NOT NULL,
  blocker_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_request_id, recipient_role),
  CHECK (btrim(permission_basis) <> ''),
  CHECK (cardinality(allowed_field_names) > 0),
  CHECK (recipient_role <> 'CONTROL_ROOM_OPERATOR' OR active_task_reference IS NOT NULL),
  CHECK (permitted OR cardinality(blocker_codes) > 0)
);

DROP TRIGGER IF EXISTS recipient_permission_resolution_immutable ON communications.recipient_permission_resolution;
CREATE TRIGGER recipient_permission_resolution_immutable
BEFORE UPDATE OR DELETE ON communications.recipient_permission_resolution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.delivery_path_resolution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_request_id uuid NOT NULL REFERENCES communications.communication_request(id) ON DELETE RESTRICT,
  resolution_sequence integer NOT NULL CHECK (resolution_sequence > 0),
  source_current boolean NOT NULL,
  recipient_permission_resolved boolean NOT NULL,
  purpose_priority_classification_resolved boolean NOT NULL,
  valid_contact_points_resolved boolean NOT NULL,
  accessibility_language_quiet_hours_resolved boolean NOT NULL,
  unsafe_channels_excluded boolean NOT NULL,
  notification_and_fallback_policy_resolved boolean NOT NULL,
  primary_attempt_state text NOT NULL CHECK (primary_attempt_state IN (
    'NOT_ATTEMPTED','QUEUED','SENT','DELIVERED','READ','ACKNOWLEDGED','FAILED','UNKNOWN','EXPIRED'
  )),
  acknowledgement_required boolean NOT NULL,
  fallback_triggered boolean NOT NULL DEFAULT false,
  fallback_source_revalidated boolean NOT NULL DEFAULT false,
  attempt_count integer NOT NULL CHECK (attempt_count >= 0),
  attempt_cap integer NOT NULL CHECK (attempt_cap >= 0),
  terminal_action text NOT NULL CHECK (terminal_action IN (
    'ATTEMPT_PRIMARY','WAIT_FOR_DELIVERY_OR_ACKNOWLEDGEMENT','ATTEMPT_FALLBACK',
    'OPEN_COMMUNICATION_FAILURE_CASE','COMPLETE','SUPPRESS_STALE','STOP_OPERATOR_CONTROL',
    'STOP_ATTEMPT_CAP','REJECT'
  )),
  provider_acceptance_treated_as_delivery boolean NOT NULL DEFAULT false CHECK (provider_acceptance_treated_as_delivery = false),
  stale_fallback_allowed boolean NOT NULL DEFAULT false CHECK (stale_fallback_allowed = false),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_request_id, resolution_sequence),
  CHECK (NOT fallback_triggered OR fallback_source_revalidated),
  CHECK (terminal_action <> 'COMPLETE' OR primary_attempt_state = 'ACKNOWLEDGED'
    OR (NOT acknowledgement_required AND primary_attempt_state IN ('DELIVERED','READ'))),
  CHECK (terminal_action <> 'SUPPRESS_STALE' OR NOT source_current),
  CHECK (terminal_action <> 'ATTEMPT_FALLBACK' OR (fallback_triggered AND source_current))
);

DROP TRIGGER IF EXISTS delivery_path_resolution_immutable ON communications.delivery_path_resolution;
CREATE TRIGGER delivery_path_resolution_immutable
BEFORE UPDATE OR DELETE ON communications.delivery_path_resolution
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_degraded_mode_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_request_id uuid REFERENCES communications.communication_request(id) ON DELETE RESTRICT,
  channel text,
  region_code text NOT NULL,
  channel_health text NOT NULL CHECK (channel_health IN (
    'HEALTHY','DEGRADED','PARTIAL_OUTAGE','OUTAGE','RECOVERING','UNKNOWN'
  )),
  shield_available boolean NOT NULL,
  high_risk_account_or_financial_change boolean NOT NULL,
  essential_journey_safety_or_safeguarding boolean NOT NULL,
  source_current boolean NOT NULL,
  duplicate_event boolean NOT NULL DEFAULT false,
  action text NOT NULL CHECK (action IN (
    'NORMAL','APPROVED_FAILOVER','DELAY_ROUTINE','HUMAN_CONTINGENCY','HOLD_FOR_REVALIDATION',
    'DISCARD_STALE','DISCARD_DUPLICATE','PAUSE_HIGH_RISK_CHANGE','CONTINUE_ESSENTIAL_CANONICAL'
  )),
  risky_change_failed_open boolean NOT NULL DEFAULT false CHECK (risky_change_failed_open = false),
  active_journey_stranded_by_shield_outage boolean NOT NULL DEFAULT false CHECK (active_journey_stranded_by_shield_outage = false),
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(region_code) <> ''),
  CHECK (action <> 'DISCARD_STALE' OR NOT source_current),
  CHECK (action <> 'DISCARD_DUPLICATE' OR duplicate_event),
  CHECK (action <> 'PAUSE_HIGH_RISK_CHANGE' OR (NOT shield_available AND high_risk_account_or_financial_change)),
  CHECK (action <> 'CONTINUE_ESSENTIAL_CANONICAL' OR essential_journey_safety_or_safeguarding)
);

DROP TRIGGER IF EXISTS communications_degraded_mode_decision_immutable ON communications.communications_degraded_mode_decision;
CREATE TRIGGER communications_degraded_mode_decision_immutable
BEFORE UPDATE OR DELETE ON communications.communications_degraded_mode_decision
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_acceptance_case_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL CHECK (scenario_key IN (
    'NORMAL_APP_BOOKING','THIRD_PARTY_BOOKING','LANDLINE_ONLY_PASSENGER',
    'DRIVER_REASSIGNMENT_RACE','RIDECHECK_MISMATCH','PASSENGER_ONBOARD_BREAKDOWN',
    'SILENT_ASSISTANCE','SCHOOL_HANDOVER_FAILURE','PAYMENT_STATUS_UNKNOWN',
    'PAYOUT_BANK_TAKEOVER','SIM_SWAP_OTP_FLOOD','TELEPHONY_AI_LOW_CONFIDENCE',
    'SMS_OUTAGE','OUTAGE_RECOVERY','DUPLICATE_EVENT_DELIVERY','OUT_OF_ORDER_EVENTS',
    'CONTACT_ABUSE','STAFF_SNOOPING'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  condition_description text NOT NULL,
  pass_criteria text NOT NULL,
  fixture_only boolean NOT NULL DEFAULT true CHECK (fixture_only = true),
  real_user_contact_allowed boolean NOT NULL DEFAULT false CHECK (real_user_contact_allowed = false),
  external_provider_execution_allowed boolean NOT NULL DEFAULT false CHECK (external_provider_execution_allowed = false),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scenario_key, version),
  CHECK (btrim(condition_description) <> '' AND btrim(pass_criteria) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_communication_acceptance_case
  ON communications.communication_acceptance_case_version (scenario_key) WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS communication_acceptance_case_version_update_guard ON communications.communication_acceptance_case_version;
CREATE TRIGGER communication_acceptance_case_version_update_guard
BEFORE UPDATE ON communications.communication_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS communication_acceptance_case_version_delete_guard ON communications.communication_acceptance_case_version;
CREATE TRIGGER communication_acceptance_case_version_delete_guard
BEFORE DELETE ON communications.communication_acceptance_case_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_acceptance_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_case_version_id uuid NOT NULL REFERENCES communications.communication_acceptance_case_version(id) ON DELETE RESTRICT,
  fixture_set_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS','FAIL')),
  evidence_reference text NOT NULL,
  authoritative_state_revalidated boolean NOT NULL,
  recipient_permissions_respected boolean NOT NULL,
  stale_or_duplicate_message_released boolean NOT NULL DEFAULT false CHECK (stale_or_duplicate_message_released = false),
  contacted_real_user boolean NOT NULL DEFAULT false CHECK (contacted_real_user = false),
  external_provider_called boolean NOT NULL DEFAULT false CHECK (external_provider_called = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(fixture_set_reference) <> '' AND btrim(evidence_reference) <> ''),
  CHECK (status <> 'PASS' OR (authoritative_state_revalidated AND recipient_permissions_respected))
);

DROP TRIGGER IF EXISTS communication_acceptance_result_immutable ON communications.communication_acceptance_result;
CREATE TRIGGER communication_acceptance_result_immutable
BEFORE UPDATE OR DELETE ON communications.communication_acceptance_result
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_launch_gate_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_key text NOT NULL CHECK (gate_key IN (
    'P0_POLICY_TEMPLATE_FALLBACK_APPROVED','RECIPIENT_PERMISSION_MATRIX_TESTED',
    'NON_SMARTPHONE_FLOW_REHEARSED','VOICE_HANDOFF_RESUME_PAYMENT_TESTED',
    'PROVIDER_OUTAGE_RECOVERY_SIMULATED','CRITICAL_WORKFLOW_DRILLS_PASSED',
    'SECURITY_DEGRADED_FALLBACK_TESTED','DELIVERY_TELEMETRY_STATES_DISTINCT',
    'UNMANAGED_PROVIDER_BYPASS_BLOCKED','CRITICAL_TEMPLATE_GOVERNANCE_READY',
    'OPERATOR_ACCESS_AND_EXPORT_AUDIT_READY','PRIVACY_AND_RETENTION_RULES_APPROVED',
    'OUTAGE_AND_ABUSE_RUNBOOKS_READY'
  )),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  acceptance_rule text NOT NULL,
  accountable_owner_role text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gate_key, version),
  CHECK (btrim(acceptance_rule) <> '' AND btrim(accountable_owner_role) <> ''),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_communication_launch_gate
  ON communications.communication_launch_gate_version (gate_key) WHERE status = 'ACTIVE';

DROP TRIGGER IF EXISTS communication_launch_gate_version_update_guard ON communications.communication_launch_gate_version;
CREATE TRIGGER communication_launch_gate_version_update_guard
BEFORE UPDATE ON communications.communication_launch_gate_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_version_close_update();
DROP TRIGGER IF EXISTS communication_launch_gate_version_delete_guard ON communications.communication_launch_gate_version;
CREATE TRIGGER communication_launch_gate_version_delete_guard
BEFORE DELETE ON communications.communication_launch_gate_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communication_launch_gate_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_gate_version_id uuid NOT NULL REFERENCES communications.communication_launch_gate_version(id) ON DELETE RESTRICT,
  evidence_sequence integer NOT NULL CHECK (evidence_sequence > 0),
  status text NOT NULL CHECK (status IN ('PASS','FAIL','NOT_TESTED')),
  evidence_reference text,
  assessed_by_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  contacted_real_user boolean NOT NULL DEFAULT false CHECK (contacted_real_user = false),
  external_provider_called boolean NOT NULL DEFAULT false CHECK (external_provider_called = false),
  production_execution_enabled boolean NOT NULL DEFAULT false CHECK (production_execution_enabled = false),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (launch_gate_version_id, evidence_sequence),
  CHECK (status <> 'PASS' OR (evidence_reference IS NOT NULL AND assessed_by_person_id IS NOT NULL))
);

DROP TRIGGER IF EXISTS communication_launch_gate_evidence_immutable ON communications.communication_launch_gate_evidence;
CREATE TRIGGER communication_launch_gate_evidence_immutable
BEFORE UPDATE OR DELETE ON communications.communication_launch_gate_evidence
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_closure_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'CANONICAL_EVENT_ACCEPTED','CANONICAL_EVENT_DEDUPLICATED','COMMUNICATION_REQUEST_VALIDATED',
    'RECIPIENT_PERMISSION_RESOLVED','DELIVERY_PATH_RESOLVED','STALE_MESSAGE_SUPPRESSED',
    'DEGRADED_MODE_ENTERED','DEGRADED_MODE_EXITED','ACCEPTANCE_CASE_RECORDED',
    'LAUNCH_GATE_EVIDENCE_RECORDED'
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

DROP TRIGGER IF EXISTS communications_closure_event_immutable ON communications.communications_closure_event;
CREATE TRIGGER communications_closure_event_immutable
BEFORE UPDATE OR DELETE ON communications.communications_closure_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_closure_command_deduplication (
  command_id uuid PRIMARY KEY,
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, idempotency_key),
  CHECK (btrim(command_type) <> '' AND btrim(idempotency_key) <> '')
);

DROP TRIGGER IF EXISTS communications_closure_command_deduplication_immutable ON communications.communications_closure_command_deduplication;
CREATE TRIGGER communications_closure_command_deduplication_immutable
BEFORE UPDATE OR DELETE ON communications.communications_closure_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.communications_closure_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  external_provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_provider_execution_enabled = false),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS communications_closure_outbox_message_immutable ON communications.communications_closure_outbox_message;
CREATE TRIGGER communications_closure_outbox_message_immutable
BEFORE UPDATE OR DELETE ON communications.communications_closure_outbox_message
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
