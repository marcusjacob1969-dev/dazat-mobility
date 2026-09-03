import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0028_control_room_fatigue_replacement_assignment.sql',
  'docs/engineering/phase-0-44-checklist.md',
  'docs/traceability/phase-0-44-fatigue-replacement-assignment.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.44 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.", "'/v1/control-room/fatigue-handovers/:controlledHandoverId/replacement-assignment'",
  'recordFatigueReplacementAssignment', 'RecordFatigueReplacementAssignment', 'CANONICAL_REPLACEMENT_VERIFIED',
  'control-room.fatigue-replacement-assignment-recorded', "status: 'REPLACEMENT_ASSIGNED'",
  "original.status IN ('CANCELLED','REASSIGNED')", "original_leg.status = 'INTERRUPTED'",
  "replacement.status = 'ACTIVE'", 'current_journey.active_assignment_id = replacement.id',
  'replacement.driver_profile_id <> handover.driver_profile_id', "operationalHoldStatus: 'ACTIVE'",
  'passengerTransferEvidenceRecorded: false', 'handoverComplete: false', 'externalServiceContacted: false']) {
  if (!source.includes(truth)) errors.push(`Replacement-assignment boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.44 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.44 verification PASSED');
console.log('Checked canonical replacement truth, terminal original work, owner authority, retained hold and truthful untransferred state.');
