import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-current.mjs'), 'utf8');
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const errors = [];
for (const truth of ['phase <=', "apps/control-room/tsconfig.json", "['run', 'test:api-runtime']", "['run', 'demo:core-journey']"]) if (!runner.includes(truth)) errors.push(`Current verification aggregate missing: ${truth}`);
if (!packageJson.includes('npm run test:domain && npm run verify:current')) errors.push('Main check does not include current checkpoint verification');
if (errors.length) { console.error('DAZAT Engineering Phase 0.67 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.67 verification PASSED');
