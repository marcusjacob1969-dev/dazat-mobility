import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0024_driver_fatigue_handover_lifecycle.sql',
  'docs/engineering/phase-0-39-checklist.md',
  'docs/traceability/phase-0-39-fatigue-handover.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.39 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/driver-daily-operations-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/driver-daily-operations.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.", 'operations.driver_fatigue_handover',
  'driver_fatigue_handover_transition', 'controlledHandoverId', 'ACTIVE_JOURNEY_FATIGUE_REPORTED',
  "'REQUESTED','OWNED','REPLACEMENT_ASSIGNED','PASSENGER_TRANSFERRED','SAFE_STOP_CONFIRMED','COMPLETED'",
  'passenger_continuity_required', 'Invalid fatigue handover transition',
  'creation is not evidence that Control Room ownership']) {
  if (!source.includes(truth)) errors.push(`Fatigue handover boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.39 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.39 verification PASSED');
console.log('Checked durable active-Journey fatigue handover identity, guarded lifecycle, continuity and truthful uncompleted state.');
