-- DAZAT Mobility — Engineering Phase 0.130
-- Give captured payments an authoritative capture timestamp.
-- provider_created_at is provider object creation time, not capture time.

ALTER TABLE finance.payment
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

CREATE OR REPLACE FUNCTION finance.guard_payment_capture_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','DISPUTED','CHARGEBACK')
     AND NEW.captured_amount_minor > 0
     AND NEW.captured_at IS NULL THEN
    RAISE EXCEPTION 'Captured payment state requires captured_at';
  END IF;

  IF NEW.status IN ('CREATED','PROCESSING','REQUIRES_ACTION','AUTHORISED','FAILED','VOIDED','EXPIRED','STATUS_UNKNOWN')
     AND NEW.captured_at IS NOT NULL THEN
    RAISE EXCEPTION 'Uncaptured payment state cannot have captured_at';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_capture_timestamp_guard ON finance.payment;
CREATE TRIGGER payment_capture_timestamp_guard
BEFORE INSERT OR UPDATE OF status, captured_amount_minor, captured_at
ON finance.payment
FOR EACH ROW EXECUTE FUNCTION finance.guard_payment_capture_timestamp();

COMMENT ON COLUMN finance.payment.captured_at IS
'Authoritative DAZAT capture timestamp; distinct from provider object creation time.';
