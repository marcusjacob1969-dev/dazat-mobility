import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
if (!app.includes("checkpoint: 'engineering-phase-0.95'")) errors.push('API build-info must identify Engineering Phase 0.95 as the current checkpoint');
if (app.includes("checkpoint: 'engineering-phase-0.91'")) errors.push('API build-info still advertises the stale Phase 0.91 checkpoint');
if (!app.includes("implementationStatus: 'CURRENT_CHECKPOINT_VERIFIED_PROVIDER_AND_OPERATIONAL_MUTATIONS_DISABLED'")) errors.push('API build-info must expose the verified current implementation status without implying provider activation');
if (errors.length) { console.error('DAZAT Engineering Phase 0.95 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.95 verification PASSED');
