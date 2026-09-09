import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-postgres.mjs'), 'utf8');
const workflow = readFileSync(join(root, '.github/workflows/postgres-migration-verification.yml'), 'utf8');
const errors = [];
for (const truth of ['getCoreJourneyProgress', 'getDriverCoreJourneyProgress', 'getControlRoomCoreJourneyProgress', "DAZAT_MIGRATION_VALIDATION_TARGET !== 'ephemeral'", 'CoreJourneyNotFoundError']) if (!runner.includes(truth)) errors.push(`PostgreSQL query verifier missing: ${truth}`);
for (const truth of ['POSTGRES_PASSWORD: dazat_ci_${{ github.run_id }}', 'verify-core-journey-postgres.mjs', 'Compile API and validate core-journey SQL']) if (!workflow.includes(truth)) errors.push(`Hosted workflow missing: ${truth}`);
if (workflow.includes('dazat_ci_local_only')) errors.push('Hosted workflow retains the static disposable password');
if (errors.length) { console.error('DAZAT Engineering Phase 0.69 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.69 verification PASSED');
