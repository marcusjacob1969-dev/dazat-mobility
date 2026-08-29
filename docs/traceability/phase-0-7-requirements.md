# Phase 0.7 Blueprint Traceability

Truth labels follow Master Blueprint §83: `SOURCE_CREATED`, `SOURCE_TESTED`, `PARTIAL_SOURCE`, or `NOT_IMPLEMENTED`. No row claims production verification.

| Blueprint requirement / acceptance | Phase 0.7 evidence | Truth |
|---|---|---|
| Finance owns money movement and ledger; Pricing owns fare calculation | PaymentIntent stores logical FareAgreement reference and immutable amount/currency; no pricing formula in Finance | SOURCE_CREATED |
| Money uses integer minor units and currency (`FIN-DAT-001`) | domain guards, bigint checks bounded to JS safe integer, ISO-style currency constraints | SOURCE_TESTED |
| Raw payment credentials do not enter DAZAT events/logs (`FIN-DAT-001`) | token-reference-only schema, recursive domain field rejection, JSON boundary constraints | SOURCE_TESTED |
| PaymentIntent and Payment are distinct | separate tables/contracts; provider-disabled command creates only PaymentIntent | SOURCE_CREATED |
| Provider timeout becomes unknown rather than blindly retried (`PAY-UNK-001`) | `STATUS_UNKNOWN`, reconciliation-required guard, response guidance and `blindRetryAllowed=false` | SOURCE_TESTED |
| Provider ingress is idempotent | unique provider/event reference, payload hash, signature status and processing state | PARTIAL_SOURCE |
| No provider-specific identity becomes DAZAT primary identity | generated internal UUIDs plus explicit external provider reference columns | SOURCE_CREATED |
| Ledger is balanced and append-only (`PAY-006`) | posting trigger requires ≥2 same-currency entries with equal debit/credit totals | SOURCE_TESTED |
| Corrections use new transactions, not historical edits (`PAY-006`) | posted transaction/entry mutation triggers and `reversal_of_transaction_id` | SOURCE_TESTED |
| APIs do not directly set balances | no balance mutation route; ledger can change only through future owner-controlled posting workflow | SOURCE_CREATED |
| Completion alone cannot imply payment | intent requires completed Booking but is a separate command; no provider/Payment/ledger writes | SOURCE_TESTED |
| Receipt requires captured Payment truth | receipt query requires `captured_amount_minor > 0`; otherwise `RECEIPT_NOT_READY` | SOURCE_CREATED |
| Rider fare and Driver earning remain separate (`PAY-EAR-001`) | dedicated DriverEarning table/projection; empty after completion unless separately posted | SOURCE_CREATED |
| DriverEarning and Payout remain separate | dedicated records plus explicit allocation table; earnings response says payout not derived | SOURCE_CREATED |
| Breakdown can charge once and allocate across legs (`PAY-BRK-001`) | Finance identities remain Booking/Journey aware; allocation policy is not yet implemented | PARTIAL_SOURCE |
| Subsidies and organisational funding remain explicit (`PAY-SUB-001`) | generic accounts can represent owners without embedding allocation assumptions | PARTIAL_SOURCE |
| Disputes/chargebacks preserve separate states (`PAY-DSP-001`) | Payment states and Finance event catalogue include dispute/chargeback truth | PARTIAL_SOURCE |
| Payout destination change is high-risk and separate | token reference plus mandatory step-up, cooling-off/security-review request | SOURCE_CREATED |
| Refund and payout commands, provider adapter/webhook and reconciliation worker | persistence/boundaries only; endpoints deliberately absent until authority/provider controls exist | NOT_IMPLEMENTED |
| Production provider selection | explicit founder/procurement gate; provider mode remains disabled | NOT_IMPLEMENTED |

## Evidence commands

```sh
npm run verify:phase-0-7
npm run test:phase-0-7-domain
git diff --check
```

PostgreSQL execution, concurrency, full dependency compilation, provider integration, PCI/accounting/legal review and app E2E remain unverified and are listed in the Phase 0.7 checklist.
