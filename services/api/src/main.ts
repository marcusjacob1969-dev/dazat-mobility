import Fastify from 'fastify';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = Fastify({ logger: { level: config.logLevel } });

app.get('/health/live', async () => ({ status: 'LIVE' }));

app.get('/health/ready', async () => ({
  status: 'NOT_READY',
  reason: 'Database/provider readiness checks are intentionally not wired in Phase 0.1.'
}));

app.get('/v1/build-info', async () => ({
  product: 'DAZAT Mobility',
  checkpoint: 'engineering-phase-0.1',
  implementationStatus: 'SOURCE_CREATED_NOT_PRODUCTION_VERIFIED'
}));

await app.listen({ host: '0.0.0.0', port: config.port });
