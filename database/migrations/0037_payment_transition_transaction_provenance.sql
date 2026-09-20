ALTER TABLE finance.payment_transition
  ADD COLUMN IF NOT EXISTS provenance_transaction_id bigint NOT NULL DEFAULT txid_current();

CREATE OR REPLACE FUNCTION finance.guard_payment_transition_provenance()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM finance.payment_transition
     WHERE payment_id = NEW.id
       AND from_status = OLD.status
       AND to_status = NEW.status
       AND provenance_transaction_id = txid_current()
  ) THEN
    RAISE EXCEPTION 'Payment status transition requires same-transaction immutable payment_transition provenance: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_transition_provenance_guard ON finance.payment;
CREATE CONSTRAINT TRIGGER payment_transition_provenance_guard
AFTER UPDATE OF status ON finance.payment
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION finance.guard_payment_transition_provenance();
