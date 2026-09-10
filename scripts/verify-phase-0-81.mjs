import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dockerfile = readFileSync(join(root, 'services/api/Dockerfile'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const ignore = readFileSync(join(root, '.dockerignore'), 'utf8');
const errors = [];
for (const truth of ['FROM node:24-bookworm-slim AS build', 'npm ci --ignore-scripts', 'npm run build:core', 'npm prune --omit=dev', 'FROM node:24-bookworm-slim AS runtime', 'USER node', 'HEALTHCHECK', '/health/live', 'CMD ["node", "services/api/dist/main.js"]']) {
  if (!dockerfile.includes(truth)) errors.push(`API container boundary missing: ${truth}`);
}
for (const truth of ['api-container:', 'docker build --file services/api/Dockerfile']) {
  if (!workflow.includes(truth)) errors.push(`Hosted container gate missing: ${truth}`);
}
for (const truth of ['.env', '**/node_modules', '**/dist']) {
  if (!ignore.includes(truth)) errors.push(`Container context exclusion missing: ${truth}`);
}
if (dockerfile.includes('PASSWORD=') || dockerfile.includes('DATABASE_URL=')) errors.push('Container image embeds runtime credentials');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.81 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.81 verification PASSED');
