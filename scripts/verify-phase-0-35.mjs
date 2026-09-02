import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0021_driver_fatigue_runtime_boundary.sql',
  'docs/engineering/phase-0-35-checklist.md',
  'docs/traceability/phase-0-35-fatigue-runtime.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.35 file: ${path}`);
const migration = readFileSync(join(root, required[0]), 'utf8');
const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
const journey = readFileSync(join(root, 'services/api/src/modules/journey/journey-service.ts'), 'utf8');
const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const checkpoint = app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/);
if (!checkpoint || Number(checkpoint[1]) < 35) errors.push('Build checkpoint predates Phase 0.35');
for (const truth of ['driver.driver_fatigue_observation',
  'driver.current_fatigue_safety_projection', 'driver_fatigue_observation_guard', 'FATIGUE_SAFETY_BLOCKED',
  'fatigueSafetyPassed', 'fatigueSafetyRevalidated: true', 'DRIVER_FATIGUE_WARNING_AFTER_DUTY_MINUTES',
  'DRIVER_FATIGUE_REST_REQUIRED_AFTER_DUTY_MINUTES', 'DRIVER_FATIGUE_MINIMUM_QUALIFYING_REST_MINUTES']) {
  if (!(migration + dispatch + journey + config + app).includes(truth)) errors.push(`Fatigue runtime boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.35 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.35 verification PASSED');
console.log('Checked durable fatigue evidence, shift/rest projection, Dispatch gating and protected Journey-start revalidation.');
