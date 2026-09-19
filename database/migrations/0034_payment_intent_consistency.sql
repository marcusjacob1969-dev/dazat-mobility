-- DAZAT Mobility — Engineering Phase 0.131
-- Enforce payment-to-intent monetary and currency consistency at the database boundary.

CREATE OR REPLACE FUNCTION finance.guard_payment_intent_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  intent_amount bigint;
  intent_currency char(3);
  intent_status finance.payment_status;
BEGIN
  SELECT amount_minor, currency, status INTO intent_amount, intent_currency, intent_status
    FROM finance.payment_intent WHERE id = NEW.payment_intent_id FOR SHARE;

  IF intent_amount IS NULL THEN RAISE EXCEPTION 'PaymentIntent does not exist'; END IF;
  IF NEW.currency <> intent_currency THEN RAISE EXCEPTION 'Payment currency must match PaymentIntent currency'; END IF;
  IF NEW.authorised_amount_minor IS NOT NULL AND NEW.authorised_amount_minor > intent_amount
    THEN RAISE EXCEPTION 'Authorised payment amount cannot exceed PaymentIntent amount'; END IF;
  IF NEW.captured_amount_minor > intent_amount
    THEN RAISE EXCEPTION 'Captured payment amount cannot exceed PaymentIntent amount'; END IF;
  IF NEW.refunded_amount_minor > NEW.captured_amount_minor
    THEN RAISE EXCEPTION 'Refunded payment amount cannot exceed captured payment amount'; END IF;
  IF NEW.status IN ('CAPTURED','PARTIALLY_REFUNDED','REFUNDED','DISPUTED','CHARGEBACK')
     AND NEW.captured_amount_minor <= 0
    THEN RAISE EXCEPTION 'Captured payment state requires a positive captured amount'; END IF;
  IF NEW.status IN ('PARTIALLY_REFUNDED','REFUNDED')
     AND NEW.refunded_amount_minor <= 0
    THEN RAISE EXCEPTION 'Refunded payment state requires a positive refunded amount'; END IF;
  IF NEW.status = 'REFUNDED' AND NEW.refunded_amount_minor <> NEW.captured_amount_minor
    THEN RAISE EXCEPTION 'REFUNDED payment must have refunded amount equal to captured amount'; END IF;
  IF intent_status = 'CREATED' AND NEW.captured_amount_minor > 0
    THEN RAISE EXCEPTION 'A CREATED PaymentIntent cannot have a captured Payment'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_intent_consistency_guard ON finance.payment;
CREATE TRIGGER payment_intent_consistency_guard
BEFORE INSERT OR UPDATE OF payment_intent_id, status, authorised_amount_minor, captured_amount_minor, refunded_amount_minor, currency
ON finance.payment
FOR EACH ROW EXECUTE FUNCTION finance.guard_payment_intent_consistency();

COMMENT ON FUNCTION finance.guard_payment_intent_consistency() IS
'Database invariant: Payment monetary state and currency must remain bounded by the authoritative PaymentIntent.';
