# Engineering Phase 0.63 — Completed assignment history

The core-journey progress query now reads the latest assignment for the latest Dispatch attempt instead of requiring that assignment to remain `ACTIVE`.

Governed Journey completion ends the assignment atomically. Filtering the projection join to active assignments therefore erased truthful Driver-assigned progress immediately after successful completion. The lateral latest-assignment read preserves historical milestone truth while the separate Driver access predicate continues to require that the authenticated Driver actually owns an assignment for the Booking.
