import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = ['services/api/src/modules/core-journey/core-journey-service.ts', 'services/api/src/modules/core-journey/routes.ts', 'openapi/dazat-api.yaml'].map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
const errors = [];
for (const truth of ['getControlRoomCoreJourneyProgress', 'control_room_task_scope task', "task.purpose = 'DRIVER_FATIGUE_HANDOVER'", 'task.valid_until > now()', '/v1/control-room/fatigue-handovers/{controlledHandoverId}/bookings/{bookingId}/core-journey-progress']) if (!source.includes(truth)) errors.push(`Task-scoped Control Room read missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.65 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.65 verification PASSED');
