import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ui = readFileSync(join(root, 'packages/design-system/src/journey-ui.ts'), 'utf8');
const index = readFileSync(join(root, 'packages/design-system/src/index.ts'), 'utf8');
const test = readFileSync(join(root, 'tests/domain/journey-ui-source.test.mjs'), 'utf8');
const errors = [];

for (const token of ['JourneyUiPhase', 'JourneyUiTone', 'mapCoreJourneyToUiState', 'SUPPORT_REQUIRED', 'PAYMENT_PROVIDER_UNAVAILABLE', 'JOURNEY_CLOSED', 'RIDE_CHECK_REQUIRED', 'DRIVER_ASSIGNMENT_REQUIRED', 'DRIVER_EN_ROUTE', 'JOURNEY_IN_PROGRESS']) {
  if (!ui.includes(token)) errors.push(`Journey UI semantic mapper missing ${token}`);
}
if (!index.includes("./journey-ui.js")) errors.push('Design-system index must export Journey UI semantics');
if (ui.includes('fetch(') || ui.includes('axios')) errors.push('Journey UI semantics must not perform network I/O');
if (!test.includes('presentation-only')) errors.push('Journey UI semantic regression test is missing');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.101 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.101 verification PASSED');
