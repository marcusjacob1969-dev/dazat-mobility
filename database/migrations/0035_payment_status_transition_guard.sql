-- DAZAT Mobility — Engineering Phase 0.143
-- Enforce the allowed Payment lifecycle at the database boundary.

CREATE OR REPLACE FUNCTION finance.guard_payment_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  allowed := CASE OLD.status
    WHEN 'CREATED' THEN NEW.status IN ('PROCESSING','REQUIRES_ACTION','AUTHORISED','FAILED','VOIDED','EXPIRED','STATUS_UNKNOWN')
    WHEN 'PROCESSING' THEN NEW.status IN ('REQUIRES_ACTION','AUTHORISED','CAPTURED','FAILED','STATUS_UNKNOWN')
    WHEN 'REQUIRES_ACTION' THEN NEW.status IN ('PROCESSING','AUTHORISED','FAILED','EXPIRED','STATUS_UNKNOWN')
    WHEN 'AUTHORISED' THEN NEW.status IN ('CAPTURED','VOIDED','FAILED','STATUS_UNKNOWN')
    WHEN 'CAPTURED' THEN NEW.status IN ('PARTIALLY_REFUNDED','REFUNDED','DISPUTED','CHARGEBACK')
    WHEN 'PARTIALLY_REFUNDED' THEN NEW.status IN ('REFUNDED','DISPUTED','CHARGEBACK')
    WHEN 'REFUNDED' THEN NEW.status IN ('DISPUTED','CHARGEBACK')
    WHEN 'STATUS_UNKNOWN' THEN NEW.status IN ('PROCESSING','REQUIRES_ACTION','AUTHORISED','CAPTURED','FAILED','VOIDED')
    WHEN 'DISPUTED' THEN NEW.status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','CHARGEBACK')
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid Payment status transition % -> %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'STATUS_UNKNOWN' AND NEW.captured_amount_minor > 0 AND NEW.captured_at IS NULL THEN
    RAISE EXCEPTION 'A Payment with captured value cannot enter STATUS_UNKNOWN without captured_at';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_status_transition_guard ON finance.payment;
CREATE TRIGGER payment_status_transition_guard
BEFORE UPDATE OF status ON finance.payment
FOR EACH ROW EXECUTE FUNCTION finance.guard_payment_status_transition();

COMMENT ON FUNCTION finance.guard_payment_status_transition() IS
'Database invariant: Payment status changes must follow the governed Payment lifecycle.';
