import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');

for (const [name, source, reader] of [
  ['Rider', rider, 'readCoreJourneyProgress'],
  ['Driver', driver, 'readDriverCoreJourneyProgress']
]) {
  if (!source.includes(reader)) throw new Error(`${name} must consume canonical Core Journey progress`);
  const transitions = source.match(/setJourney\(await get(?:Booking|Driver)Journey\([^\n]+\)\);/g) ?? [];
  if (transitions.length < 3) throw new Error(`${name} does not have enough journey transition refresh points`);
  if (!source.includes(`setCoreJourneyProgress(await ${reader}(sessionToken, ${name === 'Rider' ? 'booking.bookingId' : 'journey.bookingId'}))`)) {
    throw new Error(`${name} canonical Journey refresh is not paired with journey state`);
  }
}
console.log('DAZAT Phase 0.107 canonical transition refresh verification PASSED');
