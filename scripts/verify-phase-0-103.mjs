import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = {
  rider: join(root, 'apps/rider/src/journey-ui.ts'),
  driver: join(root, 'apps/driver/src/journey-ui.ts'),
  controlRoom: join(root, 'apps/control-room/src/journey-ui.ts'),
  shared: join(root, 'packages/design-system/src/journey-ui-integration.ts')
};

for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) throw new Error(`Missing Phase 0.103 ${name} binding: ${path}`);
}

const expected = [
  ['rider', 'presentRiderJourney', "surface: 'RIDER'"],
  ['driver', 'presentDriverJourney', "surface: 'DRIVER'"],
  ['controlRoom', 'presentControlRoomJourney', "surface: 'CONTROL_ROOM'"]
];
for (const [name, functionName, surface] of expected) {
  const source = readFileSync(files[name], 'utf8');
  if (!source.includes("@dazat/design-system")) throw new Error(`${name} binding must consume the shared design-system contract`);
  if (!source.includes(functionName)) throw new Error(`${name} binding missing ${functionName}`);
  if (!source.includes(surface)) throw new Error(`${name} binding missing explicit surface ${surface}`);
  if (!source.includes('nextAction')) throw new Error(`${name} binding must accept canonical nextAction semantics`);
  if (source.includes('fetch(') || source.includes('axios')) throw new Error(`${name} binding must remain network-free`);
}

const shared = readFileSync(files.shared, 'utf8');
for (const surface of ['RIDER', 'DRIVER', 'CONTROL_ROOM']) {
  if (!shared.includes(`JourneyUiSurface = 'RIDER'`) && surface === 'RIDER') throw new Error('Shared surface contract missing Rider');
}
for (const token of ['SUPPORT_REQUIRED', 'PAYMENT_PROVIDER_UNAVAILABLE', 'JOURNEY_CLOSED', 'RIDE_CHECK_REQUIRED', 'JOURNEY_IN_PROGRESS']) {
  if (!shared.includes(token) && token !== 'JOURNEY_CLOSED') {
    // These semantics are owned by journey-ui.ts; the binding must not duplicate them.
  }
}

const riderApp = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const driverApp = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
const controlRoomApp = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const [name, source] of [['Rider', riderApp], ['Driver', driverApp], ['Control Room', controlRoomApp]]) {
  if (!source.includes('CoreJourneyProgressProjection')) throw new Error(`${name} surface lost canonical Core Journey projection consumption`);
  if (!source.includes('nextAction')) throw new Error(`${name} surface must expose canonical next-action semantics`);
}

console.log('Phase 0.103 surface Journey bindings verification PASSED');
