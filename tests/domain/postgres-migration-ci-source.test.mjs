import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const workflow = readFileSync(`${root}/.github/workflows/postgres-migration-verification.yml`, 'utf8');

test('CI uses a disposable allowlisted PostGIS database', () => {
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /postgis\/postgis:16-3\.4/);
  assert.match(workflow, /POSTGRES_DB: dazat_migration_verify_ci/);
  assert.match(workflow, /DAZAT_MIGRATION_VALIDATION_TARGET: ephemeral/);
});

test('CI validates runner source before executing all migrations', () => {
  assert.match(workflow, /node scripts\/verify-phase-0-21\.mjs/);
  assert.match(workflow, /node --test tests\/domain\/postgres-migration-runner-source\.test\.mjs/);
  assert.match(workflow, /node scripts\/verify-postgres-migrations\.mjs/);
});

test('CI installs locked dependencies before compiling the workspace', () => {
  assert.match(workflow, /workspace-check:/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run audit:security/);
  assert.match(workflow, /npm run build --workspaces --if-present/);
  assert.match(workflow, /npm run check/);
});
