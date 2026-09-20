# Phase 0.144 — Payment transition provenance

## Purpose

Connect the existing immutable finance.payment_transition audit record to the governed Payment status lifecycle.

Phase 0.143 governs the allowed Payment status graph. Phase 0.144 adds the missing provenance boundary: a Payment status change is rejected unless a matching immutable transition record exists.

## Boundary

- payment_transition.payment_id identifies the Payment.
- payment_transition.from_status equals the Payment's previous status.
- payment_transition.to_status equals the Payment's new status.
- the existing immutable trigger prevents later alteration or deletion of the transition record.
- provider-disabled/no-real-money behaviour is unchanged.

The constraint trigger is INITIALLY IMMEDIATE, so an unproven status update fails at the statement boundary. A future legitimate mutation path can create the immutable transition record and then perform the governed Payment update in the same transaction.

## Verification

The Core Journey PostgreSQL verifier proves that a direct CAPTURED -> DISPUTED update without provenance is rejected, and that a matching transition record permits the governed update while remaining immutable.
