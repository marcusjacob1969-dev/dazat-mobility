import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const errors = [];
for (const truth of ['docker network create dazat-smoke', 'dazat-postgres-smoke', 'postgis/postgis:16-3.4', '/docker-entrypoint-initdb.d:ro', '.State.Health.Status', '--network dazat-smoke', 'dazat-postgres-smoke:5432', '/health/ready', '\"database\":\"READY\"', 'docker network rm dazat-smoke']) {
  if (!workflow.includes(truth)) errors.push(`Container dependency gate missing: ${truth}`);
}
if (workflow.includes('PAYMENT_PROVIDER_MODE=enabled')) errors.push('Container dependency gate enables charging');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.83 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.83 verification PASSED');
