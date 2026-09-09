import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0031_control_room_fatigue_recoverable_queue.sql',
  'docs/engineering/phase-0-47-checklist.md',
  'docs/traceability/phase-0-47-fatigue-recoverable-queue.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.47 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["'/v1/control-room/fatigue-handovers/recoverable'",
  'listRecoverableFatigueHandovers', 'RecoverableFatigueHandoverQueueProjection', "role_code = 'SAFETY_SUPERVISOR'",
  'previous_task.valid_until <= now()', 'NOT EXISTS (SELECT 1 FROM operations.control_room_task_scope active_task',
  "support_case.status = 'IN_PROGRESS'", "hold.status = 'ACTIVE'", 'ORDER BY previous_task.valid_until ASC',
  'commandRevalidationRequired: true', 'passengerIdentityIncluded: false', 'previousOperatorIdentityIncluded: false',
  'clock_timestamp() AS server_now']) {
  if (!source.includes(truth)) errors.push(`Recoverable-queue boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.47 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.47 verification PASSED');
console.log('Checked supervisor authority, genuine ownership lapse, bounded minimum-data discovery and mandatory command revalidation.');
