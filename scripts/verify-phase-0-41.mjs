import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = ['docs/engineering/phase-0-41-checklist.md', 'docs/traceability/phase-0-41-control-room-handover-task.md'];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.41 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.41'", "'/v1/control-room/fatigue-handovers/:controlledHandoverId'",
  'getFatigueHandoverTask', 'ControlRoomFatigueHandoverTaskProjection', 'permittedNextActions',
  'task.operator_person_id = $2', 'task.valid_until > now()', 'role_assignment.valid_until > now()',
  'passengerIdentityIncluded: false', 'passengerContactIncluded: false', 'preciseLocationIncluded: false',
  'safetyNarrativeIncluded: false', 'financialDataIncluded: false', 'taskScopeAuthoritative: true']) {
  if (!source.includes(truth)) errors.push(`Control Room task projection boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.41 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.41 verification PASSED');
console.log('Checked current task ownership, current role, minimum operational data, exact next actions and excluded sensitive scopes.');
