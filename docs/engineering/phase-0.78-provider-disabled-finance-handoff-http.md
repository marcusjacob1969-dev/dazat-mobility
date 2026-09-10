# Engineering Phase 0.78 — Provider-Disabled Finance Handoff HTTP

The hosted PostgreSQL vertical slice now connects governed Journey completion to the provider-disabled Finance boundary through real authenticated Rider HTTP routes.

The payer prepares a PaymentIntent from the completed Booking's immutable FareAgreement. The command is idempotent and preserves exact money in integer minor units. Its authoritative state remains `CREATED` with `NOT_ELIGIBLE` charging eligibility, no provider action, disabled production charging and blind retry prohibited.

The payer can read the same status, while another authenticated Rider receives a scoped denial. Receipt generation fails explicitly because no captured Payment exists. Canonical journey progress retains completed operational milestones and changes its remaining action to `PAYMENT_PROVIDER_UNAVAILABLE`; no charge or receipt is fabricated.
