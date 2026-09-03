import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const runner = readFileSync(`${root}/scripts/verify-postgres-migrations.mjs`, 'utf8');

test('migration runner requires an explicit disposable target confirmation', () => {
  assert.match(runner, /DAZAT_MIGRATION_VALIDATION_TARGET/);
  assert.match(runner, /confirmation !== 'ephemeral'/);
  assert.match(runner, /dazat_migration_verify_/);
});

test('migration runner applies the complete ordered migration chain with psql stop-on-error', () => {
  assert.match(runner, /migrations\.length !== 25/);
  assert.match(runner, /0001_foundation\.sql/);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /Applying \$\{migration\}/);
  assert.match(runner, /driver\.current_fatigue_safety_projection/);
});

test('migration runner does not create or drop the target database', () => {
  assert.doesNotMatch(runner, /CREATE DATABASE/);
  assert.doesNotMatch(runner, /DROP DATABASE/);
});
