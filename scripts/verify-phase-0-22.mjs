import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  '.github/workflows/postgres-migration-verification.yml',
  'docs/engineering/phase-0-22-checklist.md',
  'docs/traceability/phase-0-22-ci-migration-verification.md',
  'tests/domain/postgres-migration-ci-source.test.mjs'
];
const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.22 file: ${rel}`);
const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const workflow = readFileSync(join(root, required[0]), 'utf8');
for (const truth of [
  'pull_request:', 'branches: [main]', 'postgis/postgis:16-3.4',
  'POSTGRES_DB: dazat_migration_verify_ci', 'DAZAT_MIGRATION_VALIDATION_TARGET: ephemeral',
  'node-version: 24',
  'workspace-check:', 'cache: npm', 'npm ci --ignore-scripts',
  'npm run audit:security',
  'npm run build --workspaces --if-present && npm run check',
  'postgresql-client', 'node scripts/verify-phase-0-21.mjs',
  'node --test tests/domain/postgres-migration-runner-source.test.mjs',
  'node scripts/verify-postgres-migrations.mjs'
]) if (!workflow.includes(truth)) errors.push(`CI migration workflow missing: ${truth}`);
for (const [action, pattern] of [
  ['actions/checkout', /actions\/checkout@[a-f0-9]{40}/],
  ['actions/setup-node', /actions\/setup-node@[a-f0-9]{40}/]
]) if (!pattern.test(workflow)) errors.push(`CI migration workflow missing commit-pinned action: ${action}`);
if (workflow.includes('POSTGRES_PASSWORD: production') || workflow.includes('npm publish')) errors.push('CI migration workflow contains a prohibited production or publish action');

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.22 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.22 verification PASSED');
console.log('Checked disposable PostGIS CI workflow configuration without claiming a hosted CI run.');
