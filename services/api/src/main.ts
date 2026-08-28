import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { createDatabasePool } from './db.js';
import { registerIdentityRoutes } from './modules/identity/routes.js';

const config = loadConfig();
const app = Fastify({ logger: { level: config.logLevel } });
const database = createDatabasePool(config.databaseUrl);

app.get('/health/live', async () => ({ status: 'LIVE' }));

app.get('/health/ready', async (_request, reply) => {
  try {
    await database.query('SELECT 1');
    return reply.code(200).send({
      status: 'READY',
      dependencies: {
        database: 'READY',
        redis: 'NOT_REQUIRED_FOR_PHASE_0_2_IDENTITY_PATH'
      }
    });
  } catch {
    return reply.code(503).send({
      status: 'NOT_READY',
      dependencies: { database: 'UNAVAILABLE' }
    });
  }
});

app.get('/v1/build-info', async () => ({
  product: 'DAZAT Mobility',
  checkpoint: 'engineering-phase-0.2',
  implementationStatus: 'IDENTITY_ACCOUNT_FOUNDATION_SOURCE_CREATED_NOT_PRODUCTION_VERIFIED'
}));

registerIdentityRoutes(app, database);

app.addHook('onClose', async () => {
  await database.end();
});

await app.listen({ host: '0.0.0.0', port: config.port });
