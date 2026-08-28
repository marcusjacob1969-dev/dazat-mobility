import { Pool } from 'pg';

export type DatabasePool = Pool;

export function createDatabasePool(connectionString: string): DatabasePool {
  return new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'dazat-mobility-api'
  });
}
