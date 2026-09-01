import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'docs/engineering/phase-0-33-checklist.md',
  'docs/traceability/phase-0-33-bearer-boundary.md',
  'services/api/src/security/bearer-token.ts',
  'tests/api/bearer-token-runtime.test.mjs'
];
const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing Phase 0.33 file: ${path}`);
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const parser = readFileSync(join(root, 'services/api/src/security/bearer-token.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/api/bearer-token-runtime.test.mjs'), 'utf8');
for (const truth of ["checkpoint: 'engineering-phase-0.33'", 'MAXIMUM_BEARER_TOKEN_LENGTH = 512', 'bearerPattern', 'bearerTokenFromAuthorization', 'bearerTokenFromRequest']) {
  if (!(app + parser).includes(truth)) errors.push(`Shared bearer source missing: ${truth}`);
}
for (const truth of ['case-insensitive standard scheme', 'missing empty ambiguous and multi-value credentials', 'oversized credential headers']) {
  if (!tests.includes(truth)) errors.push(`Runtime bearer contract missing: ${truth}`);
}
const modulesRoot = join(root, 'services/api/src/modules');
const routeFiles = readdirSync(modulesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(modulesRoot, entry.name, 'routes.ts'))
  .filter(existsSync);
const authRoutes = routeFiles.filter((path) => readFileSync(path, 'utf8').includes('authenticateBearerSession'));
if (authRoutes.length !== 19) errors.push(`Expected 19 authenticated route modules, found ${authRoutes.length}`);
for (const path of authRoutes) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes("security/bearer-token.js")) errors.push(`Authenticated route bypasses shared bearer parser: ${path}`);
  if (/function bearer(?:FromRequest)?\(/.test(source)) errors.push(`Duplicated bearer parser remains: ${path}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.33 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.33 verification PASSED');
console.log('Checked one shared bounded bearer parser across all nineteen authenticated route modules.');
