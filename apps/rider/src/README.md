# Rider application shell

The Rider UI is intentionally not being polished before Identity and the canonical Booking/Journey APIs exist.

Current source slice continues through active Journey reconciliation, persistent SOS/Silent Assistance/route concern, governed stop requests and completion visibility. Route requests remain pending and Safety controls do not depend on external delivery success.

Phase 0.7 adds a post-completion, provider-disabled PaymentIntent preparation surface. It explicitly labels that no charge was attempted; captured Payment, refunds and receipts remain unavailable until separately established by Finance truth.

Phase 0.13 adds a shared authenticated communication inbox/read/acknowledgement client. Communication purpose, priority, recipient scope, source version and delivery truth remain authoritative server facts. Marketing consent is separate, stale notifications are suppressed, and no provider is represented as having sent or delivered a message.
