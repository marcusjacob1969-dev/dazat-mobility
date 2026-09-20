-- DAZAT Mobility — Engineering Phase 0.144
-- Require every Payment status change to have an immutable transition record.

CREATE OR REPLACE FUNCTION finance.guard_payment_transition_provenance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM finance.payment_transition
     WHERE payment_id = NEW.id
       AND from_status = OLD.status
       AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'Payment status transition requires an immutable payment_transition record: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_transition_provenance_guard ON finance.payment;
CREATE CONSTRAINT TRIGGER payment_transition_provenance_guard
AFTER UPDATE OF status ON finance.payment
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION finance.guard_payment_transition_provenance();

COMMENT ON FUNCTION finance.guard_payment_transition_provenance() IS
'Database invariant: every Payment status change must be accompanied by a matching immutable payment_transition record.';
