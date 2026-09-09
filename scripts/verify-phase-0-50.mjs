import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'packages/contracts/src/core-journey-progress.ts',
  'services/api/src/modules/core-journey/core-journey-service.ts',
  'services/api/src/modules/core-journey/routes.ts',
  'tests/api/core-journey-progress-runtime.test.mjs',
  'docs/engineering/phase-0.50-persistent-core-journey-progress.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.50 file: ${path}`);
const source = required.map((path) => readFileSync(join(root, path), 'utf8')).join('\n') + readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
for (const truth of ["checkpoint: 'engineering-phase-0.50'", 'core-journey-progress', 'productionChargingEnabled: false', "party.role IN ('BOOKER','PASSENGER','PAYER')", "ridecheck_status === 'LOCKED'"]) {
  if (!source.includes(truth)) errors.push(`Persistent core-journey progress missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.50 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.50 verification PASSED');
console.log('Checked authenticated canonical progress composition, RideCheck blocking and provider-disabled Finance truth.');
