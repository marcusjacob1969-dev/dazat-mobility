import test from 'node:test';
import assert from 'node:assert/strict';
import { money } from '../../packages/domain/dist/index.js';

test('money uses integer minor units', () => {
  assert.deepEqual(money(1299, 'GBP'), { minorUnits: 1299, currency: 'GBP' });
  assert.throws(() => money(12.99, 'GBP'));
  assert.throws(() => money(1299, 'gbp'));
});
