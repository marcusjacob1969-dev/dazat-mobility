import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'scripts/verify-postgres-migrations.mjs',
  'scripts/verify-phase-0-21.mjs',
  'scripts/sync-source-manifest.mjs',
  'docs/engineering/phase-0-21-checklist.md',
  'docs/traceability/phase-0-21-runtime-readiness.md',
  'docs/architecture/ADR-0021-postgres-migration-validation.md',
  'tests/domain/postgres-migration-runner-source.test.mjs'
];
const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.21 file: ${rel}`);
if (!errors.length) execFileSync(process.execPath, [join(root, 'scripts/sync-source-manifest.mjs')], { cwd: root, stdio: 'ignore' });
const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const runner = readFileSync(join(root, 'scripts/verify-postgres-migrations.mjs'), 'utf8');
for (const truth of [
  "DAZAT_MIGRATION_VALIDATION_TARGET", "confirmation !== 'ephemeral'", 'dazat_migration_verify_',
  'psql is required', "'ON_ERROR_STOP=1'", "'--no-psqlrc'", '0001_foundation.sql',
  'migrations.length !==', 'Applying ${migration}', 'SELECT current_database()',
  'organisation.institution_exit_plan', 'DAZAT PostgreSQL migration verification PASSED'
]) if (!runner.includes(truth)) errors.push(`Migration runner lacks safety or execution boundary: ${truth}`);
if (runner.includes('CREATE DATABASE') || runner.includes('DROP DATABASE') || runner.includes('rm -rf')) errors.push('Migration runner must not create, drop or delete a database itself');

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (packageJson.version !== '0.0.21') errors.push('Root package is not versioned at 0.0.21');
if (packageJson.scripts['verify:migrations:postgres'] !== 'node scripts/verify-postgres-migrations.mjs') errors.push('PostgreSQL migration verification command is not exposed');
if (!packageJson.scripts.check.includes('verify:phase-0-21')) errors.push('Full static check does not include Phase 0.21');
for (const rel of ['packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json', 'apps/organisation-portal/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.version !== '0.0.21') errors.push(`${rel} is not versioned at 0.0.21`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.21 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.21 verification PASSED');
console.log('Checked guarded disposable-database migration execution readiness without claiming PostgreSQL runtime evidence.');
