import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

const dockerfilePath = join(root, 'services/api/Dockerfile');
const dockerfile = existsSync(dockerfilePath) ? readFileSync(dockerfilePath, 'utf8') : '';
const pinnedBase = /^FROM node:24-bookworm-slim@sha256:[0-9a-f]{64} AS (?:build|runtime)$/gm;
if ([...dockerfile.matchAll(pinnedBase)].length !== 2) errors.push('API Dockerfile must pin both Node 24 Bookworm slim stages by immutable SHA-256 digest');
if (dockerfile.includes('FROM node:24-bookworm-slim AS ')) errors.push('API Dockerfile must not use an unpinned Node base image');
if (!dockerfile.includes('USER node')) errors.push('API runtime image must execute as the unprivileged node user');
if (!dockerfile.includes('HEALTHCHECK')) errors.push('API runtime image must retain an executable healthcheck');

const workflowPath = join(root, '.github/workflows/postgres-migration-verification.yml');
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
if (!workflow.includes('docker build --file services/api/Dockerfile --tag dazat-api:${{ github.sha }} .')) errors.push('Hosted API verification must build the repository Dockerfile');
if (!workflow.includes("docker image inspect --format '{{.Config.User}}' dazat-api:${{ github.sha }}")) errors.push('Hosted API verification must inspect the built image user');
if (!workflow.includes('npm ci --ignore-scripts')) errors.push('Hosted workspace verification must retain locked dependency installation without lifecycle scripts');

const manifestSyncPath = join(root, 'scripts/sync-source-manifest.mjs');
if (!existsSync(manifestSyncPath)) errors.push('Source manifest synchronisation script is missing');
const packagePath = join(root, 'package.json');
const packageJson = existsSync(packagePath) ? readFileSync(packagePath, 'utf8') : '';
if (!packageJson.includes('node scripts/sync-source-manifest.mjs &&')) errors.push('Repository check must synchronise the source manifest before checkpoint verification');
if (existsSync(join(root, 'SOURCE_MANIFEST_ADDITIONS.txt'))) errors.push('Legacy source manifest additions workaround must not remain');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.92 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.92 verification PASSED');
