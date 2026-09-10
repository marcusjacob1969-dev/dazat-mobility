import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dockerfile = readFileSync(join(root, 'services/api/Dockerfile'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const nodeImage = 'node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553';
const postgisImage = 'postgis/postgis:16-3.4@sha256:44126d872ac91993766c341e369c539e8196614321765d36a6f1bab0419a5fa5';
const errors = [];
if (dockerfile.split(nodeImage).length - 1 !== 2) errors.push('Both API build and runtime stages must use the verified Node digest');
if (workflow.split(postgisImage).length - 1 !== 2) errors.push('Both hosted PostGIS boundaries must use the verified digest');
if (/^FROM node:24-bookworm-slim AS/m.test(dockerfile)) errors.push('Mutable Node base-image tag remains');
if (/image: postgis\/postgis:16-3\.4\s*$/m.test(workflow)) errors.push('Mutable PostGIS service tag remains');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.85 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.85 verification PASSED');
