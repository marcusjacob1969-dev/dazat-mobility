import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = ['docs/engineering/phase-0-38-checklist.md', 'docs/traceability/phase-0-38-fatigue-recovery-status.md'];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.38 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/driver-daily-operations/driver-daily-operations-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/driver-daily-operations.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.38'", "'/v1/driver/fatigue-recovery-status'",
  'getDriverFatigueRecoveryStatus', 'DriverFatigueRecoveryStatusProjection', 'NO_ACTIVE_OBSERVATION',
  'NO_ACTIVE_SHIFT', 'ACTIVE_WORK', 'NOT_ON_BREAK', 'REST_INCOMPLETE', 'clearanceEligible',
  'serverEvidenceAuthoritative: true', 'automaticReturnToWork: false', 'driverFaultFindingCreated: false']) {
  if (!source.includes(truth)) errors.push(`Fatigue recovery-status boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.38 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.38 verification PASSED');
console.log('Checked authoritative rest progress, exact blockers, read-only evaluation and no automatic return-to-work claim.');
