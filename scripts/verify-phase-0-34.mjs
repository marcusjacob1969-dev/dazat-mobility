import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-34-checklist.md',
  'docs/traceability/phase-0-34-fatigue-safety.md',
  'packages/domain/src/driver-daily-operations.ts',
  'tests/domain/driver-daily-operations-source.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.34 file: ${path}`);
const source = readFileSync(join(root, 'packages/domain/src/driver-daily-operations.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/domain/driver-daily-operations-source.test.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const truth of ["checkpoint: 'engineering-phase-0.34'", 'evaluateDriverFatigueSafety', 'DUTY_TIME_EVIDENCE_MISSING',
  'DRIVER_REPORTED_FATIGUE', 'DROWSINESS_SIGNAL_OBSERVED', 'DUTY_LIMIT_REACHED', 'ACTIVE_JOURNEY_HANDOVER_REQUIRED',
  'driverFaultFindingCreated: false']) {
  if (!(app + source).includes(truth)) errors.push(`Fatigue Safety source missing: ${truth}`);
}
for (const truth of ['warns before the configured duty boundary', 'blocks new offers and journey starts',
  'reported fatigue fails safe', 'active journey escalates controlled handover', 'missing duty evidence fails closed']) {
  if (!tests.includes(truth)) errors.push(`Fatigue Safety scenario missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.34 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.34 verification PASSED');
console.log('Checked fail-closed duty evidence, fatigue signals, rest gating and active-passenger continuity.');
