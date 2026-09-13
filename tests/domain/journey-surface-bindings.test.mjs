import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../..', import.meta.url));
const bindings = [
  ['apps/rider/src/journey-ui.ts', 'presentRiderJourney', "surface: 'RIDER'"],
  ['apps/driver/src/journey-ui.ts', 'presentDriverJourney', "surface: 'DRIVER'"],
  ['apps/control-room/src/journey-ui.ts', 'presentControlRoomJourney', "surface: 'CONTROL_ROOM'"]
];

for (const [path, functionName, surface] of bindings) {
  const source = readFileSync(join(root, path), 'utf8');
  assert.match(source, /presentCoreJourneyForSurface/);
  assert.match(source, new RegExp(functionName));
  assert.match(source, new RegExp(surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(source, /fetch\s*\(|axios/);
}

const shared = readFileSync(join(root, 'packages/design-system/src/journey-ui-integration.ts'), 'utf8');
assert.match(shared, /export type JourneyUiSurface/);
assert.match(shared, /presentCoreJourneyForSurface/);

console.log('Journey surface binding source tests PASSED');
