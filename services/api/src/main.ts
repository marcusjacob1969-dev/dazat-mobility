import { buildApi } from './app.js';
import { loadConfig } from './config.js';
import { createDatabasePool } from './db.js';
import { installGracefulShutdown } from './runtime-lifecycle.js';

const config = loadConfig();
const database = createDatabasePool(config.databaseUrl);
const app = buildApi(config, { database });

installGracefulShutdown(app);
await app.listen({ host: '0.0.0.0', port: config.port });
