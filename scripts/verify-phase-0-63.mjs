import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'services/api/src/modules/core-journey/core-journey-service.ts'), 'utf8');
const errors = [];
if (!source.includes('LEFT JOIN LATERAL (SELECT id FROM dispatch.driver_assignment')) errors.push('Latest assignment lateral join missing');
if (!source.includes('ORDER BY assigned_at DESC LIMIT 1')) errors.push('Latest assignment ordering missing');
if (source.includes("assignment.status = 'ACTIVE'")) errors.push('Completed assignment history is still filtered out');
if (errors.length) { console.error('DAZAT Engineering Phase 0.63 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.63 verification PASSED');
