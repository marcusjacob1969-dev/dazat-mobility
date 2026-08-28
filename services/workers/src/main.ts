// Phase 0 worker shell.
// First implementation target: publish booking.outbox_message rows with idempotent retry semantics.
// The event transport is intentionally not selected in code yet; it will be hidden behind an adapter.

console.log('DAZAT workers: Phase 0.1 shell — no production worker started.');
