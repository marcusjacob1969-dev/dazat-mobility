import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const errors = [];
for (const truth of ['Smoke-test production API image', "docker image inspect --format '{{.Config.User}}'", 'docker run --detach --name dazat-api-smoke', '/health/live', '/v1/build-info', "engineering-phase-0.82", "trap 'docker logs dazat-api-smoke || true; docker rm --force dazat-api-smoke || true' EXIT"]) {
  if (!workflow.includes(truth)) errors.push(`Hosted API runtime smoke gate missing: ${truth}`);
}
if (workflow.includes('--env PAYMENT_PROVIDER_MODE=enabled')) errors.push('Container smoke test enables charging');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.82 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.82 verification PASSED');
