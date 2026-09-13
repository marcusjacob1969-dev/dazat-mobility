import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const integration = readFileSync(join(root, 'packages/design-system/src/journey-ui-integration.ts'), 'utf8');
const index = readFileSync(join(root, 'packages/design-system/src/index.ts'), 'utf8');
const test = readFileSync(join(root, 'tests/domain/journey-ui-integration.test.mjs'), 'utf8');
const errors = [];

for (const token of ['JourneyUiSurface', 'JourneyUiPresentation', 'presentCoreJourneyForSurface', 'mapCoreJourneyToUiState', 'RIDER', 'DRIVER', 'CONTROL_ROOM', 'SUPPORT_REQUIRED', 'IN_JOURNEY', 'DISPATCHING']) {
  if (!integration.includes(token)) errors.push(`Journey UI integration contract missing ${token}`);
}
if (!index.includes("./journey-ui-integration.js")) errors.push('Design-system index must export Journey UI integration contract');
if (integration.includes('fetch(') || integration.includes('axios')) errors.push('Journey UI integration contract must not perform network I/O');
if (!integration.includes('does not own journey state')) errors.push('Integration contract must remain presentation-only');
if (!test.includes('presentation-only')) errors.push('Journey UI integration regression test is missing');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.102 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.102 verification PASSED');
