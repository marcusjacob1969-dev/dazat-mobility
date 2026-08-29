import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { createDatabasePool } from './db.js';
import { registerIdentityRoutes } from './modules/identity/routes.js';
import { DevelopmentConsoleVerificationDelivery } from './modules/identity/verification-delivery-port.js';
import { registerBookingRoutes } from './modules/booking/routes.js';
import {
  DevelopmentFixturePricingAdapter,
  DisabledPricingAdapter,
  type PricingPort
} from './modules/booking/development-pricing-adapter.js';
import { registerDispatchRoutes } from './modules/dispatch/routes.js';
import { registerJourneyRoutes } from './modules/journey/routes.js';
import { registerSafetyRoutes } from './modules/safety/routes.js';

const config = loadConfig();
const app = Fastify({ logger: { level: config.logLevel } });
const database = createDatabasePool(config.databaseUrl);

const verificationDelivery = config.verificationDeliveryMode === 'development_console'
  ? new DevelopmentConsoleVerificationDelivery(config.exposeDevelopmentVerificationCode)
  : null;

const pricing: PricingPort = config.pricingMode === 'development_fixture'
  ? new DevelopmentFixturePricingAdapter(
      config.developmentQuoteAmountMinor!,
      config.developmentQuoteCurrency,
      config.quoteTtlMinutes
    )
  : new DisabledPricingAdapter();

app.get('/health/live', async () => ({ status: 'LIVE' }));

app.get('/health/ready', async (_request, reply) => {
  try {
    await database.query('SELECT 1');
    return reply.code(200).send({
      status: 'READY',
      dependencies: {
        database: 'READY',
        redis: 'NOT_REQUIRED_FOR_PHASE_0_6_TRANSACTIONAL_LIVE_JOURNEY_FOUNDATION',
        verificationDelivery: config.verificationDeliveryMode.toUpperCase(),
        pricing: config.pricingMode.toUpperCase()
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
  checkpoint: 'engineering-phase-0.6',
  implementationStatus: 'LIVE_JOURNEY_TELEMETRY_SAFETY_GOVERNED_CHANGE_AND_COMPLETION_FOUNDATION_SOURCE_CREATED_NOT_PRODUCTION_VERIFIED'
}));

registerIdentityRoutes(app, database, config, verificationDelivery);
registerBookingRoutes(app, database, pricing);
registerDispatchRoutes(app, database, config);
registerJourneyRoutes(app, database, config);
registerSafetyRoutes(app, database);

app.addHook('onClose', async () => {
  await database.end();
});

await app.listen({ host: '0.0.0.0', port: config.port });
