import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = readFileSync(join(root, 'packages/design-system/src/journey-ui-integration.ts'), 'utf8');

assert.match(source, /presentCoreJourneyForSurface/);
assert.match(source, /JourneyUiSurface/);
assert.match(source, /RIDER/);
assert.match(source, /DRIVER/);
assert.match(source, /CONTROL_ROOM/);
assert.match(source, /mapCoreJourneyToUiState/);
assert.match(source, /SUPPORT_REQUIRED/);
assert.match(source, /IN_JOURNEY/);
assert.match(source, /DISPATCHING/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /axios/);
assert.match(source, /does not own journey state, permissions, pricing, dispatch or mutations/);

console.log('Journey UI integration contract presentation-only verification PASSED');
