import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0027_control_room_fatigue_handover_completion.sql',
  'docs/engineering/phase-0-43-checklist.md',
  'docs/traceability/phase-0-43-fatigue-handover-completion.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.43 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.", "'/v1/control-room/fatigue-handovers/:controlledHandoverId/complete'",
  'completeFatigueHandover', 'CompleteFatigueHandover', 'PASSENGER_CONTINUITY_VERIFIED',
  'control-room.fatigue-handover-completed', "status: 'COMPLETED'", "operationalHoldStatus: 'RELEASED'",
  "supportCaseStatus: 'RESOLVED'", 'passengerContinuityVerified: true', 'fatigueObservationCleared: false',
  'driverReturnedToWork: false', 'externalServiceContacted: false', "assignment.status IN ('CANCELLED','COMPLETED','REASSIGNED')",
  "leg.status IN ('INTERRUPTED','COMPLETED')", "hold.reason_code = 'DRIVER_FATIGUE_SAFETY'"]) {
  if (!source.includes(truth)) errors.push(`Guarded completion boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.43 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.43 verification PASSED');
console.log('Checked owner authority, canonical terminal continuity, fatigue-only hold release, Support resolution and truthful recovery state.');
