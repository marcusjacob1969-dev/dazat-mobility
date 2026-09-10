import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  "DAZAT_MIGRATION_VALIDATION_TARGET !== 'ephemeral'", "await client.query('BEGIN')", "await client.query('ROLLBACK')",
  'buildApi', 'app.inject', 'ACTIVE_INCIDENT', 'RIDER_CANCELLED', "'CAPTURED'", 'CORE_JOURNEY_NOT_FOUND',
  'RIDER_SESSION_REQUIRED', 'AUTHENTICATION_REQUIRED'
]) if (!runner.includes(truth)) errors.push(`Database-backed HTTP verifier missing: ${truth}`);
for (const truth of ['verify-core-journey-http-postgres.mjs', 'Exercise authenticated core-journey HTTP against persisted fixtures']) {
  if (!workflow.includes(truth)) errors.push(`Hosted workflow missing: ${truth}`);
}
const checkpoint = app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/)?.[1];
if (!checkpoint || Number(checkpoint) < 70) errors.push('Build metadata predates Phase 0.70');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.70 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.70 verification PASSED');
