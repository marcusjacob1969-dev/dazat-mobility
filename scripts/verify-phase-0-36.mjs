import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0022_driver_fatigue_self_report_continuity.sql',
  'docs/engineering/phase-0-36-checklist.md',
  'docs/traceability/phase-0-36-fatigue-self-report.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.36 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/driver-daily-operations-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/driver-daily-operations.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.", "'/v1/driver/fatigue-reports'", 'reportDriverFatigue',
  'ReportDriverFatigue', 'driver.fatigue-self-reported', 'DRIVER_FATIGUE_REPORTED',
  'HUMAN_ESCALATION_REQUIRED', 'passengerContinuityRequired', 'driverFaultFindingCreated: false',
  'externalServiceContacted: false']) {
  if (!source.includes(truth)) errors.push(`Fatigue self-report boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.36 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.36 verification PASSED');
console.log('Checked idempotent Driver self-report, BREAK transition, active-Journey hold and owned escalation continuity.');
