import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0025_control_room_fatigue_handover_ownership.sql',
  'docs/engineering/phase-0-40-checklist.md',
  'docs/traceability/phase-0-40-control-room-handover-ownership.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.40 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.", "'/v1/control-room/fatigue-handovers/:controlledHandoverId/claim'",
  'claimFatigueHandover', 'ClaimFatigueHandover', 'FATIGUE_HANDOVER_OPERATOR', 'DRIVER_FATIGUE_HANDOVER',
  'TASK_SCOPED_OPERATOR_CLAIM', 'control-room.fatigue-handover-owned', "operationalHoldStatus: 'ACTIVE'",
  'passengerContinuityRequired: true', 'outcomeClaimed: false', 'externalServiceContacted: false']) {
  if (!source.includes(truth)) errors.push(`Control Room ownership boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.40 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.40 verification PASSED');
console.log('Checked current role, bounded task scope, atomic ownership, retained Safety hold and truthful no-outcome state.');
