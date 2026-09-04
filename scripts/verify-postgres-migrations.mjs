import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const confirmation = process.env.DAZAT_MIGRATION_VALIDATION_TARGET;

function fail(message) {
  console.error(`DAZAT PostgreSQL migration verification FAILED: ${message}`);
  process.exit(1);
}

if (!databaseUrl) fail('DATABASE_URL is required');
if (confirmation !== 'ephemeral') {
  fail('DAZAT_MIGRATION_VALIDATION_TARGET must equal ephemeral; this runner only accepts a disposable database');
}

let target;
try {
  target = new URL(databaseUrl);
} catch {
  fail('DATABASE_URL must be a valid PostgreSQL connection URL');
}
if (!['postgres:', 'postgresql:'].includes(target.protocol)) fail('DATABASE_URL must use postgres or postgresql');
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''));
if (!/^dazat_migration_verify_[a-z0-9_]+$/.test(databaseName)) {
  fail('database name must start dazat_migration_verify_ to prevent running against a non-disposable target');
}

const migrationsDirectory = join(root, 'database/migrations');
const migrations = readdirSync(migrationsDirectory)
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
  .sort();
if (migrations.length !== 31 || migrations[0] !== '0001_foundation.sql' || !migrations.at(-1)?.startsWith('0031_')) {
  fail('migration inventory must be the ordered 0001–0031 chain');
}

function psql(args) {
  try {
    return execFileSync('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--dbname', databaseUrl, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    if (error.code === 'ENOENT') fail('psql is required; install PostgreSQL client tools before running this command');
    const detail = String(error.stderr || error.stdout || error.message).trim();
    fail(detail || 'psql failed');
  }
}

const observedDatabase = psql(['--tuples-only', '--no-align', '--command', 'SELECT current_database()']).trim();
if (observedDatabase !== databaseName) fail(`connected database ${observedDatabase || '(unknown)'} does not match requested disposable target`);

for (const migration of migrations) {
  const path = join(migrationsDirectory, migration);
  if (!existsSync(path)) fail(`missing migration ${migration}`);
  process.stdout.write(`Applying ${migration}\n`);
  psql(['--file', path]);
}

const requiredRelations = [
  'identity.person', 'booking.booking', 'journey.journey', 'finance.payment',
  'communications.communication_request', 'organisation.organisation',
  'organisation.institutional_attention_item', 'organisation.institution_exit_plan',
  'driver.driver_fatigue_observation', 'driver.current_fatigue_safety_projection'
];
const relationList = requiredRelations.map((relation) => `'${relation}'`).join(', ');
const missing = psql(['--tuples-only', '--no-align', '--command', `SELECT string_agg(relation, ',') FROM unnest(ARRAY[${relationList}]) AS relation WHERE to_regclass(relation) IS NULL`]).trim();
if (missing) fail(`migration chain completed but required relations are absent: ${missing}`);

console.log(`DAZAT PostgreSQL migration verification PASSED (${migrations.length} migrations against ${databaseName})`);
