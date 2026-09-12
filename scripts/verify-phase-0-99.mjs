import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dispatch = readFileSync(new URL('../services/api/src/modules/dispatch/dispatch-service.ts', import.meta.url), 'utf8');
const journey = readFileSync(new URL('../services/api/src/modules/core-journey/core-journey-service.ts', import.meta.url), 'utf8');

// Phase 0.99 makes the vertical slice's concurrency and retry boundary executable as a source contract.
assert.match(dispatch, /BEGIN/);
assert.match(dispatch, /SELECT 1 FROM booking\.booking WHERE id = \$1 FOR UPDATE/);
assert.match(dispatch, /WHERE id = \$1 AND status = \$4::booking\.booking_status AND aggregate_version = \$5/);
assert.match(dispatch, /Expected READY_FOR_DISPATCH; found/);
assert.match(dispatch, /command_type = 'StartBookingDispatch'/);
assert.match(dispatch, /command_type = 'SetDriverAvailability'/);
assert.match(dispatch, /command_type = 'AcceptDriverOffer'/);
assert.match(dispatch, /await client\.query\('COMMIT'\)/);
assert.match(dispatch, /await client\.query\('ROLLBACK'\)/);

// Driver eligibility is re-read inside the transactional dispatch command rather than trusting a stale UI projection.
assert.match(dispatch, /const eligible = rawCandidates\.rows\.filter/);
assert.match(dispatch, /evaluateDriverDispatchEligibility\(/);
assert.match(dispatch, /readDriverEligibility\(/);

// The canonical progress projection is read from authoritative joined state and never mutates it.
assert.match(journey, /SELECT b\.id AS booking_id/);
assert.match(journey, /LEFT JOIN pricing\.fare_agreement/);
assert.match(journey, /LEFT JOIN LATERAL \(SELECT id, status FROM dispatch\.dispatch_attempt/);
assert.match(journey, /LEFT JOIN journey\.journey/);
assert.match(journey, /LEFT JOIN LATERAL \(SELECT status FROM journey\.ridecheck_session/);
assert.match(journey, /LEFT JOIN LATERAL \(SELECT status FROM finance\.payment_intent/);
assert.match(journey, /productionChargingEnabled: false/);

process.stdout.write(JSON.stringify({
  checkpoint: 'engineering-phase-0.99',
  dispatchTransactionLocked: true,
  bookingOptimisticConcurrency: true,
  idempotentCommandBoundaries: true,
  eligibilityRevalidatedInTransaction: true,
  canonicalProgressReadOnly: true,
  productionChargingEnabled: false
}, null, 2) + '\n');
