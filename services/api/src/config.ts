export interface ApiConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(env.API_PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API_PORT');

  const databaseUrl = env.DATABASE_URL;
  const redisUrl = env.REDIS_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!redisUrl) throw new Error('REDIS_URL is required');

  return {
    port,
    databaseUrl,
    redisUrl,
    logLevel: env.LOG_LEVEL ?? 'info'
  };
}
