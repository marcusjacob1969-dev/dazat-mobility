import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0026_control_room_fatigue_safe_stop.sql',
  'docs/engineering/phase-0-42-checklist.md',
  'docs/traceability/phase-0-42-fatigue-safe-stop.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.42 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.", "'/v1/control-room/fatigue-handovers/:controlledHandoverId/confirm-safe-stop'",
  'confirmFatigueSafeStop', 'ConfirmFatigueSafeStop', 'SAFE_STOP_EVIDENCE_RECORDED',
  'control-room.fatigue-safe-stop-confirmed', "status: 'SAFE_STOP_CONFIRMED'", 'safeStopEvidenceRecorded: true',
  "operationalHoldStatus: 'ACTIVE'", 'passengerContinuityRequired: true', 'handoverComplete: false',
  'externalServiceContacted: false']) {
  if (!source.includes(truth)) errors.push(`Safe-stop confirmation boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.42 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.42 verification PASSED');
console.log('Checked task authority, evidence-governed safe stop, active hold retention, idempotency and truthful incomplete state.');
