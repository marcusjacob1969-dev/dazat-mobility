-- DAZAT Mobility — Engineering Phase 0.127
-- Close provider-state invariant gaps at the Finance database boundary.

CREATE OR REPLACE FUNCTION finance.guard_payment_intent_provider_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'CREATED' AND (
    NEW.provider_action_attempted <> false
    OR NEW.reconciliation_required <> false
    OR NEW.provider_code IS NOT NULL
    OR NEW.provider_intent_reference IS NOT NULL
    OR NEW.charging_eligibility <> 'NOT_ELIGIBLE'
  ) THEN
    RAISE EXCEPTION 'CREATED PaymentIntent must remain provider-neutral';
  END IF;

  IF NEW.provider_action_attempted = true AND (
    NEW.status = 'CREATED'
    OR NEW.charging_eligibility <> 'APPROVED_POLICY'
    OR NEW.provider_code IS NULL
    OR NEW.provider_intent_reference IS NULL
  ) THEN
    RAISE EXCEPTION 'Provider action requires approved policy and provider references';
  END IF;

  IF NEW.provider_action_attempted = false AND (
    NEW.provider_code IS NOT NULL OR NEW.provider_intent_reference IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Provider references require provider_action_attempted=true';
  END IF;

  IF NEW.status = 'STATUS_UNKNOWN' AND NEW.reconciliation_required <> true THEN
    RAISE EXCEPTION 'STATUS_UNKNOWN requires reconciliation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_intent_provider_state_guard ON finance.payment_intent;
CREATE TRIGGER payment_intent_provider_state_guard
BEFORE INSERT OR UPDATE OF status, charging_eligibility, provider_code,
  provider_intent_reference, provider_action_attempted, reconciliation_required
ON finance.payment_intent
FOR EACH ROW EXECUTE FUNCTION finance.guard_payment_intent_provider_state();

COMMENT ON FUNCTION finance.guard_payment_intent_provider_state() IS
'Database invariant: provider-neutral payment intent state cannot advertise provider action or provider references.';
