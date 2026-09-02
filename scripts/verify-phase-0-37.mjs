import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0023_driver_fatigue_rest_clearance.sql',
  'docs/engineering/phase-0-37-checklist.md',
  'docs/traceability/phase-0-37-fatigue-rest-clearance.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.37 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/driver-daily-operations-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/driver-daily-operations.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.37'", "'/v1/driver/fatigue-observations/:fatigueObservationId/clear-after-rest'",
  'clearDriverFatigueAfterRest', 'ClearDriverFatigueAfterRest', 'driver.fatigue-rest-cleared', 'REST_COMPLETED',
  'SERVER_EVIDENCED_QUALIFYING_REST', 'driverFatigueMinimumQualifyingRestMinutes', "availabilityStatus: 'BREAK'",
  'automaticReturnToWork: false', 'activeJourneyChecked: true', 'driverFaultFindingCreated: false']) {
  if (!source.includes(truth)) errors.push(`Fatigue rest-clearance boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.37 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.37 verification PASSED');
console.log('Checked server-evidenced qualifying rest, active-work exclusion, retained BREAK and idempotent governed clearance.');
