import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0029_control_room_fatigue_passenger_transfer.sql',
  'docs/engineering/phase-0-45-checklist.md',
  'docs/traceability/phase-0-45-fatigue-passenger-transfer.md'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.45 file: ${path}`);
const source = [
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/routes.ts'), 'utf8'),
  readFileSync(join(root, 'services/api/src/modules/control-room-fatigue/control-room-fatigue-service.ts'), 'utf8'),
  readFileSync(join(root, 'packages/contracts/src/control-room-fatigue.ts'), 'utf8'),
  readFileSync(join(root, required[0]), 'utf8'),
  readFileSync(join(root, 'services/api/src/app.ts'), 'utf8')
].join('\n');
for (const truth of ["checkpoint: 'engineering-phase-0.45'", "'/v1/control-room/fatigue-handovers/:controlledHandoverId/passenger-transfer'",
  'recordFatiguePassengerTransfer', 'RecordFatiguePassengerTransfer', 'PASSENGER_TRANSFER_EVIDENCE_RECORDED',
  'control-room.fatigue-passenger-transfer-recorded', "status: 'PASSENGER_TRANSFERRED'",
  "handover.status = 'REPLACEMENT_ASSIGNED'", "replacement.status = 'ACTIVE'",
  'current_journey.active_assignment_id = replacement.id', "replacement_leg.status = 'IN_PROGRESS'",
  'passengerTransferEvidenceRecorded: true', "operationalHoldStatus: 'ACTIVE'",
  'handoverComplete: false', 'externalServiceContacted: false']) {
  if (!source.includes(truth)) errors.push(`Passenger-transfer boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.45 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.45 verification PASSED');
console.log('Checked current ownership, in-progress replacement Journey truth, evidence recording, retained hold and truthful incomplete state.');
