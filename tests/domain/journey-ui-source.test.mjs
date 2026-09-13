import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../packages/design-system/src/journey-ui.ts', import.meta.url), 'utf8');

test('Journey UI semantics remain presentation-only', () => {
  assert.match(source, /mapCoreJourneyToUiState/);
  assert.match(source, /SUPPORT_REQUIRED/);
  assert.match(source, /PAYMENT_PROVIDER_UNAVAILABLE/);
  assert.match(source, /JOURNEY_CLOSED/);
  assert.match(source, /RIDE_CHECK_REQUIRED/);
  assert.match(source, /DRIVER_ASSIGNMENT_REQUIRED/);
  assert.match(source, /DRIVER_EN_ROUTE/);
  assert.match(source, /JOURNEY_IN_PROGRESS/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /axios/);
});

test('safety and payment states are not collapsed into success', () => {
  assert.match(source, /SUPPORT_REQUIRED[\\s\\S]*?danger/);
  assert.match(source, /PAYMENT_PROVIDER_UNAVAILABLE[\\s\\S]*?warning/);
  assert.match(source, /JOURNEY_CLOSED[\\s\\S]*?positive/);
});
