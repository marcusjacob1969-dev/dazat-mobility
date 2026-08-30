-- DAZAT Mobility — Engineering Phase 0.14
-- Telephone, Voice Assistant, caller identity, canonical booking, secure payment handoff,
-- Safety routing, warm human handoff and governed recording/transcription truth.
-- No telephony, Voice Assistant, recording, transcription or interpreter provider is configured.

CREATE TABLE IF NOT EXISTS communications.call_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  status text NOT NULL CHECK (status IN (
    'STARTED','IDENTITY_ASSESSMENT','VOICE_DIALOGUE','HUMAN_QUEUE',
    'CONNECTED_TO_OPERATOR','ENDED','DROPPED','FAILED'
  )),
  presented_number_hash char(64) CHECK (presented_number_hash IS NULL OR presented_number_hash ~ '^[0-9a-f]{64}$'),
  presented_number_hint text,
  routed_service_number_reference text,
  resolved_person_id uuid REFERENCES identity.person(id) ON DELETE RESTRICT,
  language text,
  purpose text NOT NULL,
  queue text CHECK (queue IN (
    'SAFETY','SCHOOL_SAFEGUARDING','ACTIVE_JOURNEY','BREAKDOWN','TELEPHONE_BOOKING',
    'ACCESSIBILITY_ASSISTED','DRIVER','PAYMENT','ACCOUNT_SECURITY','ROUTINE_SUPPORT'
  )),
  linked_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  linked_journey_id uuid REFERENCES journey.journey(id) ON DELETE RESTRICT,
  linked_case_id uuid,
  call_quality text NOT NULL DEFAULT 'UNKNOWN' CHECK (call_quality IN ('GOOD','DEGRADED','UNSTABLE','LOST','UNKNOWN')),
  provider_reference text,
  provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (provider_execution_enabled = false),
  personal_number_exposed boolean NOT NULL DEFAULT false CHECK (personal_number_exposed = false),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (presented_number_hint IS NULL OR length(presented_number_hint) <= 100),
  CHECK (btrim(purpose) <> ''),
  CHECK ((status IN ('ENDED','DROPPED','FAILED')) = (ended_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS call_session_person_timeline_idx
  ON communications.call_session (resolved_person_id, started_at DESC)
  WHERE resolved_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_session_active_queue_idx
  ON communications.call_session (queue, started_at)
  WHERE status IN ('STARTED','IDENTITY_ASSESSMENT','VOICE_DIALOGUE','HUMAN_QUEUE','CONNECTED_TO_OPERATOR');

CREATE OR REPLACE FUNCTION communications.guard_call_session_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.direction IS DISTINCT FROM NEW.direction
     OR OLD.presented_number_hash IS DISTINCT FROM NEW.presented_number_hash
     OR OLD.presented_number_hint IS DISTINCT FROM NEW.presented_number_hint
     OR OLD.routed_service_number_reference IS DISTINCT FROM NEW.routed_service_number_reference
     OR OLD.purpose IS DISTINCT FROM NEW.purpose
     OR OLD.provider_reference IS DISTINCT FROM NEW.provider_reference
     OR OLD.provider_execution_enabled IS DISTINCT FROM NEW.provider_execution_enabled
     OR OLD.personal_number_exposed IS DISTINCT FROM NEW.personal_number_exposed
     OR OLD.started_at IS DISTINCT FROM NEW.started_at THEN
    RAISE EXCEPTION 'CallSession origin and provider truth are immutable';
  END IF;
  IF OLD.status IN ('ENDED','DROPPED','FAILED') THEN
    RAISE EXCEPTION 'Terminal CallSession cannot change';
  END IF;
  IF NOT (
    OLD.status = NEW.status
    OR (OLD.status = 'STARTED' AND NEW.status IN ('IDENTITY_ASSESSMENT','VOICE_DIALOGUE','HUMAN_QUEUE','CONNECTED_TO_OPERATOR','ENDED','DROPPED','FAILED'))
    OR (OLD.status = 'IDENTITY_ASSESSMENT' AND NEW.status IN ('VOICE_DIALOGUE','HUMAN_QUEUE','CONNECTED_TO_OPERATOR','ENDED','DROPPED','FAILED'))
    OR (OLD.status = 'VOICE_DIALOGUE' AND NEW.status IN ('HUMAN_QUEUE','CONNECTED_TO_OPERATOR','ENDED','DROPPED','FAILED'))
    OR (OLD.status = 'HUMAN_QUEUE' AND NEW.status IN ('CONNECTED_TO_OPERATOR','ENDED','DROPPED','FAILED'))
    OR (OLD.status = 'CONNECTED_TO_OPERATOR' AND NEW.status IN ('ENDED','DROPPED','FAILED'))
  ) THEN
    RAISE EXCEPTION 'Invalid CallSession transition % -> %', OLD.status, NEW.status;
  END IF;
  IF OLD.resolved_person_id IS NOT NULL AND OLD.resolved_person_id IS DISTINCT FROM NEW.resolved_person_id THEN
    RAISE EXCEPTION 'Resolved CallSession person cannot be rewritten';
  END IF;
  IF OLD.linked_booking_id IS NOT NULL AND OLD.linked_booking_id IS DISTINCT FROM NEW.linked_booking_id THEN
    RAISE EXCEPTION 'Linked Booking cannot be rewritten';
  END IF;
  IF OLD.linked_journey_id IS NOT NULL AND OLD.linked_journey_id IS DISTINCT FROM NEW.linked_journey_id THEN
    RAISE EXCEPTION 'Linked Journey cannot be rewritten';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'CallSession updated_at must advance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_session_update_guard ON communications.call_session;
CREATE TRIGGER call_session_update_guard
BEFORE UPDATE ON communications.call_session
FOR EACH ROW EXECUTE FUNCTION communications.guard_call_session_update();
DROP TRIGGER IF EXISTS call_session_delete_guard ON communications.call_session;
CREATE TRIGGER call_session_delete_guard
BEFORE DELETE ON communications.call_session
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.caller_identity_assessment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  claimed_role text NOT NULL CHECK (claimed_role IN (
    'BOOKER','PASSENGER','PAYER','GUARDIAN','CARER','SCHOOL_CONTACT',
    'BUSINESS_CONTACT','DRIVER','RESCUE_PROVIDER','UNKNOWN'
  )),
  requested_action text NOT NULL CHECK (requested_action IN (
    'CREATE_BOOKING','READ_BOOKING_STATUS','CHANGE_BOOKING','CANCEL_BOOKING','REQUEST_SUPPORT',
    'REPORT_SAFETY','ACCOUNT_RECOVERY','CHANGE_PAYOUT','CHANGE_STORED_PAYMENT','READ_SENSITIVE_PROFILE'
  )),
  verification_methods text[] NOT NULL DEFAULT ARRAY[]::text[],
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  step_up_completed boolean NOT NULL,
  outcome text NOT NULL CHECK (outcome IN (
    'VERIFIED_SCOPED','CLARIFICATION_REQUIRED','HUMAN_HANDOFF_REQUIRED','HIGH_RISK_VOICE_PROHIBITED'
  )),
  restrictions text[] NOT NULL DEFAULT ARRAY[]::text[],
  caller_id_treated_as_identity_proof boolean NOT NULL DEFAULT false CHECK (caller_id_treated_as_identity_proof = false),
  disclosure_unrestricted boolean NOT NULL DEFAULT false CHECK (disclosure_unrestricted = false),
  assessed_by_type text NOT NULL CHECK (assessed_by_type IN ('SYSTEM','OPERATOR')),
  assessed_by_id uuid,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verification_methods <@ ARRAY[
    'CALLER_ID_HINT','VERIFIED_CONTACT_CHALLENGE','IN_APP_STEP_UP','OPERATOR_EVIDENCE',
    'AUTHORISED_GUARDIAN_RECORD','ORGANISATION_AUTHORITY','VERIFIED_SUPPLIER_CONTACT'
  ]::text[]),
  CHECK (outcome <> 'VERIFIED_SCOPED' OR verification_methods && ARRAY[
    'VERIFIED_CONTACT_CHALLENGE','IN_APP_STEP_UP','OPERATOR_EVIDENCE',
    'AUTHORISED_GUARDIAN_RECORD','ORGANISATION_AUTHORITY','VERIFIED_SUPPLIER_CONTACT'
  ]::text[]),
  CHECK (requested_action NOT IN ('ACCOUNT_RECOVERY','CHANGE_PAYOUT','CHANGE_STORED_PAYMENT','READ_SENSITIVE_PROFILE') OR outcome <> 'VERIFIED_SCOPED' OR step_up_completed)
);

DROP TRIGGER IF EXISTS caller_identity_assessment_immutable ON communications.caller_identity_assessment;
CREATE TRIGGER caller_identity_assessment_immutable
BEFORE UPDATE OR DELETE ON communications.caller_identity_assessment
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS caller_identity_assessment_timeline_idx
  ON communications.caller_identity_assessment (call_session_id, assessed_at DESC);

CREATE TABLE IF NOT EXISTS communications.contact_plan_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  safe_channels text[] NOT NULL DEFAULT ARRAY[]::text[],
  arrival_method text,
  permitted_intermediary_roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  permitted_actions text[] NOT NULL DEFAULT ARRAY[]::text[],
  language text,
  accessibility_communication_needs text[] NOT NULL DEFAULT ARRAY[]::text[],
  diagnosis_stored boolean NOT NULL DEFAULT false CHECK (diagnosis_stored = false),
  personal_contact_details_exposed boolean NOT NULL DEFAULT false CHECK (personal_contact_details_exposed = false),
  policy_version text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, version),
  CHECK (safe_channels <@ ARRAY['IN_APP','PUSH','SMS','EMAIL','VOICE_CALL','LANDLINE','TEXT_RELAY','CARER_OR_RECEPTION','AUTHENTICATED_PORTAL']::text[]),
  CHECK (permitted_actions <@ ARRAY[
    'CREATE_BOOKING','READ_BOOKING_STATUS','CHANGE_BOOKING','CANCEL_BOOKING','REQUEST_SUPPORT',
    'REPORT_SAFETY','ACCOUNT_RECOVERY','CHANGE_PAYOUT','CHANGE_STORED_PAYMENT','READ_SENSITIVE_PROFILE'
  ]::text[]),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (btrim(policy_version) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_contact_plan_per_person
  ON communications.contact_plan_version (person_id) WHERE status = 'ACTIVE';

CREATE OR REPLACE FUNCTION communications.guard_contact_plan_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.person_id IS DISTINCT FROM NEW.person_id
     OR OLD.version IS DISTINCT FROM NEW.version
     OR OLD.safe_channels IS DISTINCT FROM NEW.safe_channels
     OR OLD.arrival_method IS DISTINCT FROM NEW.arrival_method
     OR OLD.permitted_intermediary_roles IS DISTINCT FROM NEW.permitted_intermediary_roles
     OR OLD.permitted_actions IS DISTINCT FROM NEW.permitted_actions
     OR OLD.language IS DISTINCT FROM NEW.language
     OR OLD.accessibility_communication_needs IS DISTINCT FROM NEW.accessibility_communication_needs
     OR OLD.diagnosis_stored IS DISTINCT FROM NEW.diagnosis_stored
     OR OLD.personal_contact_details_exposed IS DISTINCT FROM NEW.personal_contact_details_exposed
     OR OLD.policy_version IS DISTINCT FROM NEW.policy_version
     OR OLD.effective_from IS DISTINCT FROM NEW.effective_from
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'ContactPlanVersion content is immutable';
  END IF;
  IF OLD.status <> 'ACTIVE' OR NEW.status NOT IN ('SUPERSEDED','REVOKED')
     OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.effective_to <= OLD.effective_from THEN
    RAISE EXCEPTION 'ContactPlanVersion only permits one ACTIVE close transition';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_plan_version_update_guard ON communications.contact_plan_version;
CREATE TRIGGER contact_plan_version_update_guard
BEFORE UPDATE ON communications.contact_plan_version
FOR EACH ROW EXECUTE FUNCTION communications.guard_contact_plan_version_update();
DROP TRIGGER IF EXISTS contact_plan_version_delete_guard ON communications.contact_plan_version;
CREATE TRIGGER contact_plan_version_delete_guard
BEFORE DELETE ON communications.contact_plan_version
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.voice_dialogue_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL UNIQUE REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN (
    'INTENT_DETECTED','REQUIRED_FIELDS_COLLECTION','READBACK','CONFIRMATION',
    'BACKEND_COMMAND','RESULT','HUMAN_HANDOFF','ABANDONED'
  )),
  intent text,
  model_version text,
  language text,
  recognition_failure_count integer NOT NULL DEFAULT 0 CHECK (recognition_failure_count >= 0),
  human_handoff_required boolean NOT NULL DEFAULT false,
  backend_validation_bypassed boolean NOT NULL DEFAULT false CHECK (backend_validation_bypassed = false),
  transcript_treated_as_authority boolean NOT NULL DEFAULT false CHECK (transcript_treated_as_authority = false),
  provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (provider_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communications.voice_field_capture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_dialogue_session_id uuid NOT NULL REFERENCES communications.voice_dialogue_session(id) ON DELETE RESTRICT,
  field_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('SPEECH_RECOGNITION','DTMF','OPERATOR','SAVED_VERIFIED_PROFILE')),
  value_reference text NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explicit_readback_completed boolean NOT NULL,
  caller_confirmed boolean NOT NULL,
  usable_for_commitment boolean NOT NULL,
  transcript_treated_as_authority boolean NOT NULL DEFAULT false CHECK (transcript_treated_as_authority = false),
  captured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(field_name) <> '' AND btrim(value_reference) <> ''),
  CHECK (field_name NOT IN ('PICKUP','DESTINATION','DATE_TIME','PASSENGER_IDENTITY','ACCESSIBILITY_REQUIREMENTS','FINAL_PRICE') OR NOT usable_for_commitment OR (explicit_readback_completed AND caller_confirmed))
);

CREATE OR REPLACE FUNCTION communications.guard_voice_dialogue_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.call_session_id IS DISTINCT FROM NEW.call_session_id
     OR OLD.intent IS DISTINCT FROM NEW.intent
     OR OLD.model_version IS DISTINCT FROM NEW.model_version
     OR OLD.language IS DISTINCT FROM NEW.language
     OR OLD.backend_validation_bypassed IS DISTINCT FROM NEW.backend_validation_bypassed
     OR OLD.transcript_treated_as_authority IS DISTINCT FROM NEW.transcript_treated_as_authority
     OR OLD.provider_execution_enabled IS DISTINCT FROM NEW.provider_execution_enabled
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'VoiceDialogueSession origin and safety truth are immutable';
  END IF;
  IF OLD.status IN ('RESULT','HUMAN_HANDOFF','ABANDONED') THEN
    RAISE EXCEPTION 'Terminal VoiceDialogueSession cannot change';
  END IF;
  IF NOT (
    OLD.status = NEW.status
    OR (OLD.status = 'INTENT_DETECTED' AND NEW.status IN ('REQUIRED_FIELDS_COLLECTION','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'REQUIRED_FIELDS_COLLECTION' AND NEW.status IN ('READBACK','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'READBACK' AND NEW.status IN ('CONFIRMATION','REQUIRED_FIELDS_COLLECTION','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'CONFIRMATION' AND NEW.status IN ('BACKEND_COMMAND','REQUIRED_FIELDS_COLLECTION','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'BACKEND_COMMAND' AND NEW.status IN ('RESULT','HUMAN_HANDOFF'))
  ) THEN
    RAISE EXCEPTION 'Invalid VoiceDialogueSession transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.recognition_failure_count < OLD.recognition_failure_count THEN
    RAISE EXCEPTION 'Recognition failure count cannot decrease';
  END IF;
  IF OLD.human_handoff_required AND NOT NEW.human_handoff_required THEN
    RAISE EXCEPTION 'Human handoff requirement cannot be cleared';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'VoiceDialogueSession updated_at must advance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS voice_dialogue_update_guard ON communications.voice_dialogue_session;
CREATE TRIGGER voice_dialogue_update_guard
BEFORE UPDATE ON communications.voice_dialogue_session
FOR EACH ROW EXECUTE FUNCTION communications.guard_voice_dialogue_update();
DROP TRIGGER IF EXISTS voice_dialogue_delete_guard ON communications.voice_dialogue_session;
CREATE TRIGGER voice_dialogue_delete_guard
BEFORE DELETE ON communications.voice_dialogue_session
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS voice_field_capture_immutable ON communications.voice_field_capture;
CREATE TRIGGER voice_field_capture_immutable
BEFORE UPDATE OR DELETE ON communications.voice_field_capture
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.telephone_booking_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL UNIQUE REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN (
    'COLLECTING','READBACK_REQUIRED','AWAITING_CONFIRMATION','BACKEND_SUBMITTED',
    'BOOKING_CREATED','HUMAN_HANDOFF','ABANDONED'
  )),
  booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  canonical_booking_engine_used boolean NOT NULL DEFAULT true CHECK (canonical_booking_engine_used = true),
  pickup_explicitly_chosen boolean NOT NULL DEFAULT false,
  ambiguous_location_remaining boolean NOT NULL DEFAULT true,
  booker_passenger_payer_separated boolean NOT NULL DEFAULT false,
  quote_terms_confirmed boolean NOT NULL DEFAULT false,
  capacity_confirmed boolean NOT NULL DEFAULT false,
  confirmed_critical_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  separate_reduced_function_system_used boolean NOT NULL DEFAULT false CHECK (separate_reduced_function_system_used = false),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CHECK ((status = 'BOOKING_CREATED') = (booking_id IS NOT NULL)),
  CHECK (confirmed_critical_fields <@ ARRAY['PICKUP','DESTINATION','DATE_TIME','PASSENGER_IDENTITY','ACCESSIBILITY_REQUIREMENTS','FINAL_PRICE']::text[]),
  CHECK (status <> 'BOOKING_CREATED' OR (
    booking_id IS NOT NULL AND pickup_explicitly_chosen AND NOT ambiguous_location_remaining
    AND booker_passenger_payer_separated AND quote_terms_confirmed AND capacity_confirmed
    AND confirmed_critical_fields @> ARRAY['PICKUP','DESTINATION','DATE_TIME','PASSENGER_IDENTITY','ACCESSIBILITY_REQUIREMENTS','FINAL_PRICE']::text[]
  ))
);

CREATE TABLE IF NOT EXISTS communications.call_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  from_queue text,
  to_queue text NOT NULL CHECK (to_queue IN (
    'SAFETY','SCHOOL_SAFEGUARDING','ACTIVE_JOURNEY','BREAKDOWN','TELEPHONE_BOOKING',
    'ACCESSIBILITY_ASSISTED','DRIVER','PAYMENT','ACCOUNT_SECURITY','ROUTINE_SUPPORT'
  )),
  reason_code text NOT NULL,
  caller_claim_context_present boolean NOT NULL,
  verification_context_present boolean NOT NULL,
  captured_fields_context_present boolean NOT NULL,
  authoritative_case_context_present boolean NOT NULL,
  unresolved_question_present boolean NOT NULL,
  transcript_summary_reference text,
  warm_handoff boolean NOT NULL,
  transferred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT warm_handoff OR (
    caller_claim_context_present AND verification_context_present AND captured_fields_context_present
    AND authoritative_case_context_present AND unresolved_question_present
  ))
);

CREATE OR REPLACE FUNCTION communications.guard_telephone_booking_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.call_session_id IS DISTINCT FROM NEW.call_session_id
     OR OLD.canonical_booking_engine_used IS DISTINCT FROM NEW.canonical_booking_engine_used
     OR OLD.separate_reduced_function_system_used IS DISTINCT FROM NEW.separate_reduced_function_system_used
     OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'TelephoneBookingSession identity and authority truth are immutable';
  END IF;
  IF OLD.status IN ('BOOKING_CREATED','HUMAN_HANDOFF','ABANDONED') THEN
    RAISE EXCEPTION 'Terminal TelephoneBookingSession cannot change';
  END IF;
  IF NOT (
    OLD.status = NEW.status
    OR (OLD.status = 'COLLECTING' AND NEW.status IN ('READBACK_REQUIRED','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'READBACK_REQUIRED' AND NEW.status IN ('AWAITING_CONFIRMATION','COLLECTING','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'AWAITING_CONFIRMATION' AND NEW.status IN ('BACKEND_SUBMITTED','COLLECTING','HUMAN_HANDOFF','ABANDONED'))
    OR (OLD.status = 'BACKEND_SUBMITTED' AND NEW.status IN ('BOOKING_CREATED','HUMAN_HANDOFF'))
  ) THEN
    RAISE EXCEPTION 'Invalid TelephoneBookingSession transition % -> %', OLD.status, NEW.status;
  END IF;
  IF OLD.booking_id IS NOT NULL AND OLD.booking_id IS DISTINCT FROM NEW.booking_id THEN
    RAISE EXCEPTION 'Telephone Booking link cannot be rewritten';
  END IF;
  IF (OLD.pickup_explicitly_chosen AND NOT NEW.pickup_explicitly_chosen)
     OR (NOT OLD.ambiguous_location_remaining AND NEW.ambiguous_location_remaining)
     OR (OLD.booker_passenger_payer_separated AND NOT NEW.booker_passenger_payer_separated)
     OR (OLD.quote_terms_confirmed AND NOT NEW.quote_terms_confirmed)
     OR (OLD.capacity_confirmed AND NOT NEW.capacity_confirmed) THEN
    RAISE EXCEPTION 'Confirmed telephone Booking truth cannot be reversed';
  END IF;
  IF NOT NEW.confirmed_critical_fields @> OLD.confirmed_critical_fields THEN
    RAISE EXCEPTION 'Confirmed critical fields cannot be removed';
  END IF;
  IF NEW.updated_at <= OLD.updated_at THEN
    RAISE EXCEPTION 'TelephoneBookingSession updated_at must advance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telephone_booking_update_guard ON communications.telephone_booking_session;
CREATE TRIGGER telephone_booking_update_guard
BEFORE UPDATE ON communications.telephone_booking_session
FOR EACH ROW EXECUTE FUNCTION communications.guard_telephone_booking_update();
DROP TRIGGER IF EXISTS telephone_booking_delete_guard ON communications.telephone_booking_session;
CREATE TRIGGER telephone_booking_delete_guard
BEFORE DELETE ON communications.telephone_booking_session
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS call_transfer_immutable ON communications.call_transfer;
CREATE TRIGGER call_transfer_immutable
BEFORE UPDATE OR DELETE ON communications.call_transfer
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.callback_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('REQUESTED','SCHEDULED','COMPLETED','CANCELLED','PROHIBITED')),
  purpose text NOT NULL,
  queue text NOT NULL,
  requested_window_start timestamptz,
  requested_window_end timestamptz,
  contact_point_id uuid REFERENCES identity.contact_point(id) ON DELETE RESTRICT,
  caller_id_treated_as_identity_proof boolean NOT NULL DEFAULT false CHECK (caller_id_treated_as_identity_proof = false),
  safety_or_safeguarding_deferral_allowed boolean NOT NULL DEFAULT false CHECK (safety_or_safeguarding_deferral_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_window_end IS NULL OR requested_window_start IS NOT NULL),
  CHECK (requested_window_end IS NULL OR requested_window_end > requested_window_start)
);

CREATE TABLE IF NOT EXISTS communications.secure_payment_handoff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  payment_intent_id uuid REFERENCES finance.payment_intent(id) ON DELETE RESTRICT,
  route text NOT NULL CHECK (route IN ('SECURE_PAYMENT_LINK','TOKENISED_SAVED_METHOD','PCI_IVR','UNAVAILABLE','RECONCILIATION_REQUIRED')),
  status text NOT NULL CHECK (status IN ('CREATED','PRESENTED','COMPLETED','FAILED','STATUS_UNKNOWN','CANCELLED')),
  safe_method_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_card_details_captured boolean NOT NULL DEFAULT false CHECK (raw_card_details_captured = false),
  blind_repeat_collection_allowed boolean NOT NULL DEFAULT false CHECK (blind_repeat_collection_allowed = false),
  caller_identity_authority_expanded_by_payment boolean NOT NULL DEFAULT false CHECK (caller_identity_authority_expanded_by_payment = false),
  provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (provider_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(safe_method_metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS communications.call_recording (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('NOT_PERMITTED','SCHEDULED','RECORDING','STOPPED','FAILED','UNAVAILABLE')),
  purpose text NOT NULL,
  legal_basis_reference text,
  retention_policy_version text,
  access_policy_version text,
  encrypted_content_reference text,
  provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (provider_execution_enabled = false),
  unrelated_model_training_allowed boolean NOT NULL DEFAULT false CHECK (unrelated_model_training_allowed = false),
  started_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('RECORDING','STOPPED') OR (
    legal_basis_reference IS NOT NULL AND retention_policy_version IS NOT NULL AND access_policy_version IS NOT NULL
  ))
);

CREATE TABLE IF NOT EXISTS communications.call_transcript (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  recording_id uuid REFERENCES communications.call_recording(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('NOT_PERMITTED','PENDING','AVAILABLE','FAILED','UNAVAILABLE')),
  transcript_content_reference text,
  model_version text,
  transcript_authoritative boolean NOT NULL DEFAULT false CHECK (transcript_authoritative = false),
  unrelated_model_training_allowed boolean NOT NULL DEFAULT false CHECK (unrelated_model_training_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communications.transcript_correction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES communications.call_transcript(id) ON DELETE RESTRICT,
  original_segment_reference text NOT NULL,
  corrected_value_reference text NOT NULL,
  reason_code text NOT NULL,
  corrected_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  original_transcript_rewritten boolean NOT NULL DEFAULT false CHECK (original_transcript_rewritten = false)
);

DROP TRIGGER IF EXISTS call_transcript_immutable ON communications.call_transcript;
CREATE TRIGGER call_transcript_immutable
BEFORE UPDATE OR DELETE ON communications.call_transcript
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();
DROP TRIGGER IF EXISTS transcript_correction_immutable ON communications.transcript_correction;
CREATE TRIGGER transcript_correction_immutable
BEFORE UPDATE OR DELETE ON communications.transcript_correction
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.interpreter_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  language text NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED','CONNECTED','ENDED','UNAVAILABLE','FAILED')),
  provider_reference text,
  critical_translation_validated boolean NOT NULL DEFAULT false,
  machine_translation_treated_as_authoritative boolean NOT NULL DEFAULT false CHECK (machine_translation_treated_as_authoritative = false),
  provider_execution_enabled boolean NOT NULL DEFAULT false CHECK (provider_execution_enabled = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS safety.safety_attention_signal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  signal_source text NOT NULL CHECK (signal_source IN ('EXPLICIT_CALLER_REPORT','PHRASE_CLASSIFIER','DTMF','OPERATOR')),
  category text NOT NULL,
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  immediate_danger_reported boolean NOT NULL,
  human_assessment_required boolean NOT NULL DEFAULT true CHECK (human_assessment_required = true),
  proves_danger_or_misconduct boolean NOT NULL DEFAULT false CHECK (proves_danger_or_misconduct = false),
  emergency_services_replaced boolean NOT NULL DEFAULT false CHECK (emergency_services_replaced = false),
  observed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(category) <> '')
);

DROP TRIGGER IF EXISTS safety_attention_signal_immutable ON safety.safety_attention_signal;
CREATE TRIGGER safety_attention_signal_immutable
BEFORE UPDATE OR DELETE ON safety.safety_attention_signal
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.pending_telephone_interaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL UNIQUE REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  telephone_booking_session_id uuid REFERENCES communications.telephone_booking_session(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('ACTIVE','CALL_DROPPED','RESUMED','COMPLETED','ABANDONED')),
  confirmed_field_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  unresolved_question text,
  idempotency_key text NOT NULL,
  existing_booking_id uuid REFERENCES booking.booking(id) ON DELETE RESTRICT,
  duplicate_booking_creation_allowed boolean NOT NULL DEFAULT false CHECK (duplicate_booking_creation_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(confirmed_field_references) = 'array'),
  UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS communications.call_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN (
    'CALL_STARTED','CALLER_ROLE_CLAIMED','CALLER_VERIFIED','VOICE_INTENT_DETECTED','FIELD_CAPTURED',
    'CONFIRMATION_FAILED','HUMAN_HANDOFF_REQUESTED','CALL_TRANSFERRED','BOOKING_CREATED_BY_TELEPHONE',
    'SECURE_PAYMENT_HANDOFF_CREATED','CALL_DROPPED','CALLBACK_SCHEDULED','SAFETY_PHRASE_DETECTED',
    'CALL_RECORDING_STARTED','CALL_RECORDING_STOPPED','TELEPHONY_CHANNEL_DEGRADED','TELEPHONY_CHANNEL_RECOVERED'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);

DROP TRIGGER IF EXISTS call_event_immutable ON communications.call_event;
CREATE TRIGGER call_event_immutable
BEFORE UPDATE OR DELETE ON communications.call_event
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.telephony_command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  call_session_id uuid REFERENCES communications.call_session(id) ON DELETE RESTRICT,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, idempotency_key)
);

DROP TRIGGER IF EXISTS telephony_command_deduplication_immutable ON communications.telephony_command_deduplication;
CREATE TRIGGER telephony_command_deduplication_immutable
BEFORE UPDATE OR DELETE ON communications.telephony_command_deduplication
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS communications.telephony_outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS telephony_outbox_unpublished_idx
  ON communications.telephony_outbox_message (occurred_at) WHERE published_at IS NULL;

COMMENT ON TABLE communications.call_session IS 'Provider-disabled telephony session; caller ID is only a routing hint and raw numbers are not stored.';
COMMENT ON TABLE communications.telephone_booking_session IS 'Telephone orchestration state that may commit only through the canonical Booking Engine after complete readback.';
COMMENT ON TABLE communications.secure_payment_handoff IS 'Provider-disabled secure payment route; operators/general voice never receive raw card details.';
COMMENT ON TABLE communications.call_transcript IS 'Transcript is governed evidence and never authoritative operational truth.';
