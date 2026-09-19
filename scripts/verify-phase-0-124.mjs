import assert from 'node:assert/strict';
import { canTransitionPaymentStatus } from '../packages/domain/src/finance.ts';
const statuses = ['CREATED','PROCESSING','REQUIRES_ACTION','AUTHORISED','CAPTURED','PARTIALLY_REFUNDED','REFUNDED','FAILED','VOIDED','EXPIRED','STATUS_UNKNOWN','DISPUTED','CHARGEBACK'];
for (const from of statuses) {
  for (const to of statuses) {
    if (from === 'CREATED' && to === 'CAPTURED') assert.equal(canTransitionPaymentStatus(from, to), false);
    if (from === 'CAPTURED' && to === 'CREATED') assert.equal(canTransitionPaymentStatus(from, to), false);
    if (from === 'FAILED' || from === 'VOIDED' || from === 'EXPIRED' || from === 'CHARGEBACK') assert.equal(canTransitionPaymentStatus(from, to), false);
  }
}
console.log('Phase 0.124 payment transition exhaustiveness PASSED');
