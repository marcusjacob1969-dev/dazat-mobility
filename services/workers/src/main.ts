// Phase 0.13 worker shell.
// Communication intent, delivery plans and outbox truth now exist, but no external SMS, email,
// push, telephony or chat adapter is selected. A future worker must revalidate source aggregate
// versions before every attempt and retain UNKNOWN instead of retrying blindly.

console.log('DAZAT workers: Phase 0.13 provider-disabled shell — no external delivery worker started.');
