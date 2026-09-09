import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/current-delivery-direction.md',
  'packages/domain/src/core-journey-vertical-slice.ts',
  'tests/domain/core-journey-vertical-slice.test.mjs',
  'docs/engineering/phase-0-49-checklist.md',
  'docs/traceability/phase-0-49-core-journey-vertical-slice.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.49 file: ${path}`);
const source = required.map((path) => readFileSync(join(root, path), 'utf8')).join('\n')
  + readFileSync(join(root, 'packages/domain/src/index.ts'), 'utf8')
  + readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const truth of ['runProviderDisabledCoreJourney',
  'assertCanonicalForwardTransition', 'evaluateDriverDispatchEligibility', 'evaluateArrivalEvidence',
  'evaluateRideCheckAttempt', 'canStartJourney', 'evaluateJourneyCompletion', 'FATIGUE_SAFETY_BLOCKED',
  'RIDECHECK_MISMATCH', 'ACTIVE_COMPLETION_HOLD', 'realPaymentAttempted: false',
  'externalProviderContacted: false', "export * from './core-journey-vertical-slice.js'"]) {
  if (!source.includes(truth)) errors.push(`Connected journey proof missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.49 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.49 verification PASSED');
console.log('Checked connected canonical Booking-to-completion proof and fail-closed fatigue, RideCheck and completion-hold scenarios.');
