-- DAZAT Mobility — Engineering Phase 0.7
-- Provider-neutral payment truth and balanced append-only ledger foundation.
-- This migration does not configure a payment provider and cannot initiate a charge.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finance' AND t.typname='payment_status') THEN
    CREATE TYPE finance.payment_status AS ENUM (
      'CREATED','PROCESSING','REQUIRES_ACTION','AUTHORISED','CAPTURED','PARTIALLY_REFUNDED',
      'REFUNDED','FAILED','VOIDED','EXPIRED','STATUS_UNKNOWN','DISPUTED','CHARGEBACK'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finance' AND t.typname='ledger_direction') THEN
    CREATE TYPE finance.ledger_direction AS ENUM ('DEBIT','CREDIT');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS finance.payment_intent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  fare_agreement_id uuid NOT NULL,
  payer_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  status finance.payment_status NOT NULL DEFAULT 'CREATED',
  provider_code text,
  provider_intent_reference text,
  charging_eligibility text NOT NULL DEFAULT 'NOT_ELIGIBLE' CHECK (charging_eligibility IN ('NOT_ELIGIBLE','APPROVED_POLICY')),
  provider_action_attempted boolean NOT NULL DEFAULT false,
  reconciliation_required boolean NOT NULL DEFAULT false,
  aggregate_version bigint NOT NULL DEFAULT 1 CHECK (aggregate_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((provider_code IS NULL) = (provider_intent_reference IS NULL)),
  CHECK (status <> 'CREATED' OR provider_action_attempted = false),
  CHECK (status IN ('CREATED','EXPIRED','VOIDED') OR charging_eligibility = 'APPROVED_POLICY')
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_payment_intent_per_booking
  ON finance.payment_intent (booking_id)
  WHERE status IN ('CREATED','PROCESSING','REQUIRES_ACTION','AUTHORISED','STATUS_UNKNOWN');

COMMENT ON TABLE finance.payment_intent IS 'DAZAT-owned intent state. CREATED is provider-neutral and performs no charge.';
COMMENT ON COLUMN finance.payment_intent.booking_id IS 'Logical Booking reference; Finance does not own the Booking aggregate.';
COMMENT ON COLUMN finance.payment_intent.fare_agreement_id IS 'Logical immutable FareAgreement reference; Pricing owns calculation.';

CREATE TABLE IF NOT EXISTS finance.payment_intent_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES finance.payment_intent(id) ON DELETE RESTRICT,
  from_status finance.payment_status,
  to_status finance.payment_status NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  command_id uuid NOT NULL,
  reason_code text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_intent_id, aggregate_version),
  UNIQUE (command_id)
);

DROP TRIGGER IF EXISTS payment_intent_transition_immutable ON finance.payment_intent_transition;
CREATE TRIGGER payment_intent_transition_immutable
BEFORE UPDATE OR DELETE ON finance.payment_intent_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS finance.payment_method_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  provider_code text NOT NULL,
  provider_token_reference text NOT NULL,
  method_type text NOT NULL,
  display_label text,
  expiry_month smallint CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year smallint CHECK (expiry_year BETWEEN 2020 AND 2200),
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, provider_token_reference),
  CHECK (lower(safe_metadata::text) !~ '"(pan|card[_-]?number|full[_-]?card[_-]?number|cvv|cvc|security[_-]?code|track[_-]?data|pin|pin[_-]?block)"[[:space:]]*:')
);

COMMENT ON TABLE finance.payment_method_reference IS 'Token references and safe display metadata only. Raw PAN, CVV/CVC, PIN and track data are prohibited.';

CREATE TABLE IF NOT EXISTS finance.payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES finance.payment_intent(id) ON DELETE RESTRICT,
  provider_code text NOT NULL,
  provider_payment_reference text NOT NULL,
  status finance.payment_status NOT NULL,
  authorised_amount_minor bigint CHECK (authorised_amount_minor >= 0 AND authorised_amount_minor <= 9007199254740991),
  captured_amount_minor bigint NOT NULL DEFAULT 0 CHECK (captured_amount_minor >= 0 AND captured_amount_minor <= 9007199254740991),
  refunded_amount_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_amount_minor >= 0 AND refunded_amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  provider_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, provider_payment_reference),
  CHECK (refunded_amount_minor <= captured_amount_minor)
);

CREATE TABLE IF NOT EXISTS finance.payment_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES finance.payment(id) ON DELETE RESTRICT,
  from_status finance.payment_status,
  to_status finance.payment_status NOT NULL,
  provider_event_inbox_id uuid,
  reason_code text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS payment_transition_immutable ON finance.payment_transition;
CREATE TRIGGER payment_transition_immutable
BEFORE UPDATE OR DELETE ON finance.payment_transition
FOR EACH ROW EXECUTE FUNCTION identity.prevent_immutable_mutation();

CREATE TABLE IF NOT EXISTS finance.provider_event_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL,
  provider_event_reference text NOT NULL,
  event_type text NOT NULL,
  payload_sha256 char(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  safe_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_verified boolean NOT NULL,
  processing_status text NOT NULL CHECK (processing_status IN ('RECEIVED','PROCESSED','REJECTED','HELD_FOR_RECONCILIATION')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider_code, provider_event_reference),
  CHECK (lower(safe_payload::text) !~ '"(pan|card[_-]?number|full[_-]?card[_-]?number|cvv|cvc|security[_-]?code|track[_-]?data|pin|pin[_-]?block)"[[:space:]]*:')
);

ALTER TABLE finance.payment_transition
  ADD CONSTRAINT payment_transition_provider_event_fk
  FOREIGN KEY (provider_event_inbox_id) REFERENCES finance.provider_event_inbox(id) ON DELETE RESTRICT;

COMMENT ON TABLE finance.provider_event_inbox IS 'Idempotent provider ingress boundary; safe payload subset only, never raw payment credentials.';

CREATE TABLE IF NOT EXISTS finance.reconciliation_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES finance.payment_intent(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES finance.payment(id) ON DELETE RESTRICT,
  provider_event_inbox_id uuid REFERENCES finance.provider_event_inbox(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN','RESOLVED','MANUAL_REVIEW')),
  reason_code text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((status = 'RESOLVED' AND resolved_at IS NOT NULL) OR (status <> 'RESOLVED' AND resolved_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_one_open_reconciliation_case
  ON finance.reconciliation_case (payment_intent_id) WHERE status IN ('OPEN','MANUAL_REVIEW');

CREATE OR REPLACE FUNCTION finance.guard_payment_intent_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  allowed := CASE OLD.status
    WHEN 'CREATED' THEN NEW.status IN ('PROCESSING','EXPIRED','VOIDED')
    WHEN 'PROCESSING' THEN NEW.status IN ('REQUIRES_ACTION','AUTHORISED','FAILED','STATUS_UNKNOWN')
    WHEN 'REQUIRES_ACTION' THEN NEW.status IN ('PROCESSING','AUTHORISED','FAILED','EXPIRED','STATUS_UNKNOWN')
    WHEN 'AUTHORISED' THEN NEW.status IN ('CAPTURED','VOIDED','STATUS_UNKNOWN')
    WHEN 'CAPTURED' THEN NEW.status IN ('PARTIALLY_REFUNDED','REFUNDED','DISPUTED','CHARGEBACK')
    WHEN 'PARTIALLY_REFUNDED' THEN NEW.status IN ('PARTIALLY_REFUNDED','REFUNDED','DISPUTED','CHARGEBACK')
    WHEN 'REFUNDED' THEN NEW.status IN ('DISPUTED','CHARGEBACK')
    WHEN 'STATUS_UNKNOWN' THEN NEW.status IN ('REQUIRES_ACTION','AUTHORISED','CAPTURED','FAILED','VOIDED')
    WHEN 'DISPUTED' THEN NEW.status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','CHARGEBACK')
    ELSE false
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid PaymentIntent status transition % -> %', OLD.status, NEW.status; END IF;
  IF NEW.aggregate_version <> OLD.aggregate_version + 1 THEN RAISE EXCEPTION 'PaymentIntent transition must increment aggregate_version by one'; END IF;
  IF NEW.status = 'STATUS_UNKNOWN' AND NEW.reconciliation_required <> true THEN
    RAISE EXCEPTION 'STATUS_UNKNOWN requires reconciliation and forbids blind retry';
  END IF;
  IF NEW.status NOT IN ('CREATED','EXPIRED','VOIDED') AND (
    NEW.charging_eligibility <> 'APPROVED_POLICY'
    OR NEW.provider_code IS NULL
    OR NEW.provider_intent_reference IS NULL
    OR NEW.provider_action_attempted <> true
  ) THEN RAISE EXCEPTION 'Provider action requires separately approved charging eligibility and an external provider reference'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_intent_status_guard ON finance.payment_intent;
CREATE TRIGGER payment_intent_status_guard
BEFORE UPDATE OF status ON finance.payment_intent
FOR EACH ROW EXECUTE FUNCTION finance.guard_payment_intent_status_transition();

CREATE TABLE IF NOT EXISTS finance.financial_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('PLATFORM','RIDER','DRIVER','ORGANISATION','PROVIDER','TAX_AUTHORITY','OTHER')),
  owner_reference uuid,
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('ACTIVE','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_code, currency)
);

COMMENT ON TABLE finance.financial_account IS 'Generic ledger account identity. Commercial principal/agent and tax semantics require an approved accounting policy.';

CREATE TABLE IF NOT EXISTS finance.ledger_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED')),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  business_reference_type text NOT NULL,
  business_reference_id uuid NOT NULL,
  reversal_of_transaction_id uuid REFERENCES finance.ledger_transaction(id) ON DELETE RESTRICT,
  reason_code text NOT NULL,
  correlation_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reversal_of_transaction_id),
  CHECK ((status = 'POSTED' AND posted_at IS NOT NULL) OR (status = 'DRAFT' AND posted_at IS NULL)),
  CHECK (reversal_of_transaction_id IS NULL OR reversal_of_transaction_id <> id)
);

CREATE TABLE IF NOT EXISTS finance.ledger_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_transaction_id uuid NOT NULL REFERENCES finance.ledger_transaction(id) ON DELETE RESTRICT,
  financial_account_id uuid NOT NULL REFERENCES finance.financial_account(id) ON DELETE RESTRICT,
  direction finance.ledger_direction NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  entry_sequence integer NOT NULL CHECK (entry_sequence > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ledger_transaction_id, entry_sequence)
);

CREATE OR REPLACE FUNCTION finance.prevent_posted_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'POSTED' THEN
    RAISE EXCEPTION 'Posted ledger transactions are immutable; use a reversal transaction';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS ledger_transaction_posted_immutable ON finance.ledger_transaction;
CREATE TRIGGER ledger_transaction_posted_immutable
BEFORE UPDATE OR DELETE ON finance.ledger_transaction
FOR EACH ROW EXECUTE FUNCTION finance.prevent_posted_ledger_mutation();

CREATE OR REPLACE FUNCTION finance.prevent_ledger_entry_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text; transaction_currency char(3); account_currency char(3);
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'Ledger entries are immutable; use a reversal transaction';
  END IF;
  SELECT status, currency INTO parent_status, transaction_currency
    FROM finance.ledger_transaction WHERE id = NEW.ledger_transaction_id FOR UPDATE;
  IF parent_status IS NULL THEN RAISE EXCEPTION 'Ledger transaction does not exist'; END IF;
  IF parent_status <> 'DRAFT' THEN RAISE EXCEPTION 'Entries cannot be appended to a posted ledger transaction'; END IF;
  SELECT currency INTO account_currency FROM finance.financial_account WHERE id = NEW.financial_account_id;
  IF account_currency IS NULL THEN RAISE EXCEPTION 'Financial account does not exist'; END IF;
  IF NEW.currency <> transaction_currency OR NEW.currency <> account_currency THEN
    RAISE EXCEPTION 'Ledger entry, transaction and account currencies must match';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ledger_entry_immutable ON finance.ledger_entry;
CREATE TRIGGER ledger_entry_immutable
BEFORE INSERT OR UPDATE OR DELETE ON finance.ledger_entry
FOR EACH ROW EXECUTE FUNCTION finance.prevent_ledger_entry_mutation();

CREATE OR REPLACE FUNCTION finance.validate_ledger_posting()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_count bigint; debit_total numeric; credit_total numeric; wrong_currency_count bigint; reversal_mismatch_count bigint;
BEGIN
  IF NEW.status = 'POSTED' AND OLD.status = 'DRAFT' THEN
    SELECT count(*),
           COALESCE(sum(amount_minor) FILTER (WHERE direction = 'DEBIT'), 0),
           COALESCE(sum(amount_minor) FILTER (WHERE direction = 'CREDIT'), 0),
           count(*) FILTER (WHERE currency <> NEW.currency)
      INTO entry_count, debit_total, credit_total, wrong_currency_count
      FROM finance.ledger_entry WHERE ledger_transaction_id = NEW.id;
    IF entry_count < 2 THEN RAISE EXCEPTION 'A posted ledger transaction requires at least two entries'; END IF;
    IF wrong_currency_count <> 0 THEN RAISE EXCEPTION 'Ledger transaction entries must use the transaction currency'; END IF;
    IF debit_total <> credit_total THEN RAISE EXCEPTION 'A posted ledger transaction must balance debits and credits'; END IF;
    IF NEW.reversal_of_transaction_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM finance.ledger_transaction original
         WHERE original.id = NEW.reversal_of_transaction_id
           AND original.status = 'POSTED' AND original.currency = NEW.currency
      ) THEN RAISE EXCEPTION 'A reversal must reference a posted transaction in the same currency'; END IF;
      WITH original AS (
        SELECT financial_account_id,
               CASE direction WHEN 'DEBIT' THEN 'CREDIT'::finance.ledger_direction ELSE 'DEBIT'::finance.ledger_direction END AS direction,
               sum(amount_minor) AS amount_minor
          FROM finance.ledger_entry WHERE ledger_transaction_id = NEW.reversal_of_transaction_id
         GROUP BY financial_account_id, direction
      ), candidate AS (
        SELECT financial_account_id, direction, sum(amount_minor) AS amount_minor
          FROM finance.ledger_entry WHERE ledger_transaction_id = NEW.id
         GROUP BY financial_account_id, direction
      )
      SELECT count(*) INTO reversal_mismatch_count
        FROM original o FULL JOIN candidate c
          ON c.financial_account_id = o.financial_account_id AND c.direction = o.direction
       WHERE o.financial_account_id IS NULL OR c.financial_account_id IS NULL OR o.amount_minor <> c.amount_minor;
      IF reversal_mismatch_count <> 0 THEN RAISE EXCEPTION 'A reversal must exactly invert the original ledger entries'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ledger_transaction_balance_guard ON finance.ledger_transaction;
CREATE TRIGGER ledger_transaction_balance_guard
BEFORE UPDATE ON finance.ledger_transaction
FOR EACH ROW EXECUTE FUNCTION finance.validate_ledger_posting();

CREATE TABLE IF NOT EXISTS finance.refund (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES finance.payment(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('CREATED','PROCESSING','COMPLETED','FAILED','STATUS_UNKNOWN')),
  reason_code text NOT NULL,
  provider_refund_reference text,
  ledger_transaction_id uuid REFERENCES finance.ledger_transaction(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS finance.driver_earning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  journey_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('POSTED','ADJUSTED','REVERSED')),
  ledger_transaction_id uuid NOT NULL REFERENCES finance.ledger_transaction(id) ON DELETE RESTRICT,
  policy_version text NOT NULL,
  posted_at timestamptz NOT NULL,
  UNIQUE (journey_id)
);

COMMENT ON TABLE finance.driver_earning IS 'Amount owed to a Driver. It is never derived by displaying the Rider fare.';

CREATE TABLE IF NOT EXISTS finance.payout_destination_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL,
  provider_code text NOT NULL,
  provider_token_reference text NOT NULL,
  masked_destination_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING_ACTIVATION','ACTIVE','REVOKED')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, provider_token_reference),
  CHECK ((status = 'ACTIVE' AND activated_at IS NOT NULL) OR status <> 'ACTIVE')
);

CREATE TABLE IF NOT EXISTS finance.payout_destination_change_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL,
  proposed_destination_reference_id uuid NOT NULL REFERENCES finance.payout_destination_reference(id) ON DELETE RESTRICT,
  requested_by_person_id uuid NOT NULL REFERENCES identity.person(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('PENDING_STEP_UP','COOLING_OFF','SECURITY_REVIEW','APPROVED','REJECTED','CANCELLED')),
  step_up_required boolean NOT NULL DEFAULT true CHECK (step_up_required = true),
  cooling_off_until timestamptz,
  security_reason_code text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (status <> 'COOLING_OFF' OR cooling_off_until IS NOT NULL)
);

COMMENT ON TABLE finance.payout_destination_change_request IS 'High-risk workflow separate from payout execution; never instantly changes an active destination.';

CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_payout_destination_per_driver
  ON finance.payout_destination_reference (driver_profile_id) WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS finance_one_open_payout_destination_change_per_driver
  ON finance.payout_destination_change_request (driver_profile_id)
  WHERE status IN ('PENDING_STEP_UP','COOLING_OFF','SECURITY_REVIEW','APPROVED');

CREATE TABLE IF NOT EXISTS finance.payout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency char(3) NOT NULL CHECK (currency = upper(currency) AND currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('CREATED','PROCESSING','COMPLETED','FAILED','STATUS_UNKNOWN','SECURITY_HELD')),
  payout_destination_reference_id uuid NOT NULL REFERENCES finance.payout_destination_reference(id) ON DELETE RESTRICT,
  provider_code text,
  provider_payout_reference text,
  ledger_transaction_id uuid REFERENCES finance.ledger_transaction(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((provider_code IS NULL) = (provider_payout_reference IS NULL))
);

CREATE TABLE IF NOT EXISTS finance.payout_earning_allocation (
  payout_id uuid NOT NULL REFERENCES finance.payout(id) ON DELETE RESTRICT,
  driver_earning_id uuid NOT NULL REFERENCES finance.driver_earning(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  PRIMARY KEY (payout_id, driver_earning_id)
);

CREATE TABLE IF NOT EXISTS finance.command_deduplication (
  command_id uuid PRIMARY KEY,
  idempotency_key text NOT NULL,
  command_type text NOT NULL,
  actor_id uuid NOT NULL,
  scope_reference_id uuid NOT NULL,
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (command_type, actor_id, scope_reference_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS finance.outbox_message (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN (
    'finance.payment-authorised','finance.payment-captured','finance.payment-failed','finance.payment-status-unknown',
    'finance.refund-created','finance.refund-completed','finance.driver-earning-posted','finance.payout-created',
    'finance.payout-completed','finance.payout-security-held','finance.invoice-issued'
  )),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  security_classification text NOT NULL DEFAULT 'RESTRICTED' CHECK (security_classification IN ('CONFIDENTIAL','RESTRICTED')),
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type),
  CHECK (lower(payload::text) !~ '"(pan|card[_-]?number|full[_-]?card[_-]?number|cvv|cvc|security[_-]?code|track[_-]?data|pin|pin[_-]?block)"[[:space:]]*:')
);

CREATE INDEX IF NOT EXISTS finance_outbox_unpublished_idx
  ON finance.outbox_message (occurred_at) WHERE published_at IS NULL;

CREATE OR REPLACE VIEW finance.payment_status_projection AS
SELECT pi.id AS payment_intent_id,
       pi.booking_id,
       pi.payer_person_id,
       pi.amount_minor,
       pi.currency,
       pi.status,
       pi.charging_eligibility,
       pi.provider_action_attempted,
       pi.reconciliation_required,
       pi.updated_at
  FROM finance.payment_intent pi;

CREATE OR REPLACE VIEW finance.driver_earnings_projection AS
SELECT de.id AS driver_earning_id,
       de.driver_profile_id,
       de.booking_id,
       de.journey_id,
       de.amount_minor,
       de.currency,
       de.status,
       de.posted_at
  FROM finance.driver_earning de;
