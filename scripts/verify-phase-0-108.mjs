import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
const controlRoomApi = readFileSync(join(root, 'apps/control-room/src/core-journey-api.ts'), 'utf8');
const routes = readFileSync(join(root, 'services/api/src/modules/core-journey/routes.ts'), 'utf8');
const service = readFileSync(join(root, 'services/api/src/modules/core-journey/core-journey-service.ts'), 'utf8');

for (const [name, source, reader] of [
  ['Rider', rider, 'readCoreJourneyProgress'],
  ['Driver', driver, 'readDriverCoreJourneyProgress']
]) {
  if (!source.includes(reader)) throw new Error(`${name} must consume canonical Core Journey progress`);
  const transitions = source.match(/setJourney\(await get(?:Booking|Driver)Journey\([^\n]+\);/g) ?? [];
  if (transitions.length < 3) throw new Error(`${name} does not have enough journey transition refresh points`);
  if (!source.includes(`setCoreJourneyProgress(await ${reader}(sessionToken, ${name === 'Rider' ? 'booking.bookingId' : 'journey.bookingId'}))`)) {
    throw new Error(`${name} canonical Journey refresh is not paired with journey state`);
  }
}

if (!controlRoom.includes('readTaskScopedCoreJourneyProgress')) throw new Error('Control Room must consume task-scoped canonical Core Journey progress');
if (!controlRoom.includes('setJourneyProgress(await readTaskScopedCoreJourneyProgress')) throw new Error('Control Room must refresh canonical Journey progress from its HTTP reader');
if (!controlRoomApi.includes('/v1/control-room/fatigue-handovers/')) throw new Error('Control Room HTTP reader must use the task-scoped Core Journey route');
if (!controlRoomApi.includes('controlledHandoverId') || !controlRoomApi.includes('bookingId')) throw new Error('Control Room HTTP reader must carry both handover and booking scope');
if (!routes.includes("app.get('/v1/bookings/:bookingId/core-journey-progress'")) throw new Error('Rider Core Journey HTTP route is missing');
if (!routes.includes("app.get('/v1/driver/bookings/:bookingId/core-journey-progress'")) throw new Error('Driver Core Journey HTTP route is missing');
if (!routes.includes("app.get('/v1/control-room/fatigue-handovers/:controlledHandoverId/bookings/:bookingId/core-journey-progress'")) throw new Error('Control Room Core Journey HTTP route is missing');
if (!service.includes("task.purpose = 'DRIVER_FATIGUE_HANDOVER'")) throw new Error('Control Room Core Journey service must remain task-scoped to fatigue handover authority');
if (routes.includes("POST '/v1/bookings/:bookingId/core-journey-progress'") || routes.includes("app.post('/v1/bookings/:bookingId/core-journey-progress'")) throw new Error('Core Journey progress must remain read-only');

for (const functionName of ['sendSos', 'markDestinationApproach', 'finishJourney']) {
  const start = driver.indexOf(`function ${functionName}()`);
  if (start < 0) throw new Error(`Driver transition function ${functionName} is missing`);
  const end = driver.indexOf('\n  function ', start + 10);
  const block = driver.slice(start, end < 0 ? undefined : end);
  if (!block.includes('setJourney(await getDriverJourney(sessionToken, journey.journeyId))')) throw new Error(`${functionName} must refresh detailed Journey state`);
  if (!block.includes('setCoreJourneyProgress(await readDriverCoreJourneyProgress(sessionToken, journey.bookingId))')) throw new Error(`${functionName} must refresh canonical Core Journey progress`);
}

console.log('DAZAT Phase 0.108 completion-path canonical refresh verification PASSED');
