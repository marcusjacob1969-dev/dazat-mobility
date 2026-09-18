import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = {
  rider: join(root, 'apps/rider/App.tsx'),
  driver: join(root, 'apps/driver/App.tsx'),
  controlRoom: join(root, 'apps/control-room/src/App.tsx'),
  riderBinding: join(root, 'apps/rider/src/journey-ui.ts'),
  driverBinding: join(root, 'apps/driver/src/journey-ui.ts'),
  controlRoomBinding: join(root, 'apps/control-room/src/journey-ui.ts'),
  shared: join(root, 'packages/design-system/src/journey-ui-integration.ts'),
  journeyUi: join(root, 'packages/design-system/src/journey-ui.ts')
};
for (const [name, path] of Object.entries(files)) if (!existsSync(path)) throw new Error(`Missing Phase 0.104 ${name}: ${path}`);
const source = Object.fromEntries(Object.entries(files).map(([name, path]) => [name, readFileSync(path, 'utf8')]));
for (const [name, surface, functionName] of [['rider', 'RIDER', 'presentRiderJourney'], ['driver', 'DRIVER', 'presentDriverJourney']]) {
  const binding = source[`${name}Binding`];
  const app = source[name];
  if (!binding.includes(functionName) || !binding.includes(`surface: '${surface}'`)) throw new Error(`${name} surface binding is incomplete`);
  if (!app.includes(functionName)) throw new Error(`${name} screen does not consume its surface binding`);
  if (!app.includes('const journeyPresentation = coreJourneyProgress')) throw new Error(`${name} screen does not derive presentation from canonical Core Journey progress`);
  if (!app.includes('accessibilityLabel="' + (name === 'rider' ? 'Rider' : 'Driver') + ' canonical Journey projection"')) throw new Error(`${name} screen projection summary is missing`);
}
if (!source.controlRoomBinding.includes('presentControlRoomJourney')) throw new Error('Control Room surface binding is incomplete');
if (!source.controlRoom.includes('presentCoreJourneyForSurface')) throw new Error('Control Room screen does not consume shared Journey presentation contract');
if (!source.controlRoom.includes("surface: 'CONTROL_ROOM'")) throw new Error('Control Room screen surface is not explicit');
if (!source.controlRoom.includes('const journeyPresentation = journeyProgress')) throw new Error('Control Room screen does not derive presentation from canonical Journey progress');
if (!source.controlRoom.includes('aria-label="Control Room canonical Journey projection"')) throw new Error('Control Room screen projection summary is missing');
for (const token of ['mapCoreJourneyToUiState', 'JourneyUiState', 'JourneyUiPhase']) if (!source.shared.includes(token)) throw new Error(`Shared Journey UI adapter missing ${token}`);
for (const token of ['SUPPORT_REQUIRED', 'PAYMENT_PROVIDER_UNAVAILABLE', 'JOURNEY_CLOSED', 'RIDE_CHECK_REQUIRED', 'JOURNEY_IN_PROGRESS']) if (!source.shared.includes(token) && !source.journeyUi.includes(token)) throw new Error(`Shared Journey UI contract missing ${token}`);
for (const [name, app] of Object.entries({ rider: source.rider, driver: source.driver, controlRoom: source.controlRoom })) {
  if (!app.includes('CoreJourneyProgressProjection')) throw new Error(`${name} lost canonical projection type`);
  if (app.includes('mapCoreJourneyToUiState')) throw new Error(`${name} must use the surface binding rather than mapping semantics directly`);
}
console.log('Phase 0.104 screen projection verification PASSED');
