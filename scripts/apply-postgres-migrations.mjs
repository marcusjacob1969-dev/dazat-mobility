import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const root = new URL('../', import.meta.url);
const migrationsDirectory = new URL('../database/migrations/', import.meta.url);
const migrations = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
  .sort();

if (!migrations.length) throw new Error('No PostgreSQL migrations found');

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query('BEGIN');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dazat_schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['dazat-mobility-schema-migrations']);

  const appliedResult = await client.query('SELECT version FROM public.dazat_schema_migrations ORDER BY version');
  const applied = new Set(appliedResult.rows.map((row) => row.version));

  for (const migration of migrations) {
    if (applied.has(migration)) continue;
    console.log(`Applying PostgreSQL migration ${migration}`);
    const sql = await readFile(join(root.pathname, 'database/migrations', migration), 'utf8');
    await client.query(sql);
    await client.query(
      'INSERT INTO public.dazat_schema_migrations (version) VALUES ($1)',
      [migration]
    );
  }

  await client.query('COMMIT');
  console.log(`PostgreSQL migrations ready: ${migrations.length} discovered, ${migrations.length - applied.size} applied this start`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('PostgreSQL migration failed; API startup aborted');
  throw error;
} finally {
  await client.end();
}
