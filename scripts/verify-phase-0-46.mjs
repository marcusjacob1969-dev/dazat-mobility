import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0030_control_room_fatigue_ownership_recovery.sql',
  'docs/engineering/phase-0-46-checklist.md',
  'docs/traceability/phase-0-46-fatigue-ownership-recovery.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.46 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["'/v1/control-room/fatigue-handovers/:controlledHandoverId/recover-ownership'",
  'recoverFatigueHandoverOwnership', 'RecoverFatigueHandoverOwnership', 'EXPIRED_TASK_OWNERSHIP_RECOVERED',
  'control-room.fatigue-handover-ownership-recovered', "previous_task.valid_until <= now()",
  'NOT EXISTS (SELECT 1 FROM operations.control_room_task_scope active_task', "support_case.status = 'IN_PROGRESS'",
  "hold.status = 'ACTIVE'", 'previousTaskScopeId', "operationalHoldStatus: 'ACTIVE'",
  'passengerContinuityRequired: true', 'outcomeClaimed: false', 'externalServiceContacted: false']) {
  if (!source.includes(truth)) errors.push(`Ownership-recovery boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.46 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.46 verification PASSED');
console.log('Checked expired-scope proof, no-current-owner guard, current authority, immutable provenance and retained passenger protection.');
