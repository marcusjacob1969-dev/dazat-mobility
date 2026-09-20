# Phase 0.143 — Payment lifecycle transition guard

Adds a PostgreSQL guard for Payment status transitions and executable proof that a captured Payment cannot be rewound to CREATED or AUTHORISED. This closes the previously identified gap where PaymentIntent lifecycle was guarded but Payment lifecycle had no equivalent status-transition trigger.
