import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = ['packages/contracts/src/core-journey-progress.ts', 'services/api/src/modules/core-journey/core-journey-service.ts', 'apps/rider/App.tsx', 'apps/driver/App.tsx', 'openapi/dazat-api.yaml'];
const source = files.map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
const errors = [];
for (const truth of ["'ACTIVE' | 'CLOSED' | 'SUPPORT_REQUIRED'", "nextAction: closedException ? 'JOURNEY_CLOSED' : supportException ? 'SUPPORT_REQUIRED'", 'Journey interrupted — support required', 'interruptionReason: { type: string }']) {
  if (!source.includes(truth)) errors.push(`Interrupted journey truth missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.61 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.61 verification PASSED');
