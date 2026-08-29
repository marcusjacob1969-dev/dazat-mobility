# ADR-0007: Provider-neutral Payment and Ledger Truth

Status: Accepted for Engineering Phase 0.7 source checkpoint
Date: 2026-08-29

## Context

Phase 0.6 ends with governed Journey completion and explicitly initiates no payment. The Master Blueprint gives Finance sole authority over payment and money movement while Pricing owns Quote and FareAgreement calculation. DAZAT must preserve Rider charges, provider state, ledger history, Driver earnings, refunds and payouts as distinct facts. A production provider, commercial principal/agent position, tax treatment and Driver economics are not yet approved.

## Decision

1. All money is stored as integer minor units plus a three-letter uppercase currency. Floating-point money is prohibited.
2. `PaymentIntent` is DAZAT-owned intent/state and `Payment` is a distinct provider/customer movement record. Provider identifiers remain external references, never internal primary keys.
3. The only Rider mutation in this checkpoint prepares a canonical `CREATED` PaymentIntent from the immutable FareAgreement after governed Booking completion. It makes no provider call, captures no money, posts no ledger entries and changes no Booking or Journey state.
4. `PAYMENT_PROVIDER_MODE` is hard-coded/fail-closed to `disabled`. Choosing and contracting a production provider is a founder/procurement gate. No Stripe, Adyen or other provider-specific assumption is embedded in this source.
5. Provider timeouts become `STATUS_UNKNOWN`, require reconciliation and forbid blind retry. Idempotent provider-event inbox and reconciliation persistence are defined, but no webhook endpoint is exposed until provider signature verification and internal authority are implemented.
6. Ledger transactions are balanced in one currency before posting. Posted transactions and all entries are immutable. Corrections use a new direction-reversed transaction linked to the original; balances are never directly edited.
7. `Refund`, `DriverEarning` and `Payout` are separate owned records. Journey completion does not create any of them. Rider FareAgreement values are never projected as Driver earnings.
8. Payout destination references are tokenized. Destination changes are a separate step-up/cooling-off/security-review workflow and cannot be executed through the payout path.
9. Raw PAN, CVV/CVC, PIN and track data are prohibited from Finance metadata, event inboxes and outbox events. Only provider token references and safe display metadata are modelled.
10. Receipts are derived only from captured Payment truth. A completed Journey or `CREATED` PaymentIntent returns `RECEIPT_NOT_READY`.

## Consequences

- The source can safely establish Finance ownership before a provider is selected, but cannot charge, refund, settle or pay out.
- Payment uncertainty remains visible and recoverable without duplicate-charge risk.
- Ledger history is reconstructable and correction-safe, while final chart-of-accounts, tax and commercial semantics wait for approved policy.
- Driver-facing earnings remain truthful even when no DriverEarning has been posted.
- PostgreSQL migration/runtime, provider certification, accounting review, tax/legal review, PCI scope validation and end-to-end concurrency remain required before any production money movement.
