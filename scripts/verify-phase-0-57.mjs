import { readFileSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); const source = readFileSync(join(root, 'tests/api/core-journey-access-runtime.test.mjs'), 'utf8'); const errors = [];
for (const truth of ['indistinguishable from absent Bookings', 'rowCount: 0', 'Driver profile', 'queryAttempted, false']) if (!source.includes(truth)) errors.push(`Non-disclosure contract missing: ${truth}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.57 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); } console.log('DAZAT Engineering Phase 0.57 verification PASSED');
