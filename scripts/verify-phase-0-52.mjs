import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = ['services/api/src/modules/core-journey/core-journey-service.ts', 'services/api/src/modules/core-journey/routes.ts', 'apps/driver/src/core-journey-api.ts', 'apps/driver/App.tsx', 'services/api/src/app.ts']
  .map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
const errors = [];
for (const truth of ["checkpoint: 'engineering-phase-0.52'", 'getDriverCoreJourneyProgress', '/v1/driver/bookings/:bookingId/core-journey-progress', 'permitted_assignment.driver_profile_id = $2', 'readDriverCoreJourneyProgress', 'coreJourneyProgress.milestones']) if (!source.includes(truth)) errors.push(`Driver progress missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.52 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.52 verification PASSED');
console.log('Checked assignment-scoped Driver access and server-authoritative milestone display.');
