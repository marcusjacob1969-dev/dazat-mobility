import Fastify, { type FastifyInstance } from 'fastify';
import type { ApiConfig } from './config.js';
import type { DatabasePool } from './db.js';
import { registerIdentityRoutes } from './modules/identity/routes.js';
import { DevelopmentConsoleVerificationDelivery, type ContactVerificationDeliveryPort } from './modules/identity/verification-delivery-port.js';
import { registerBookingRoutes } from './modules/booking/routes.js';
import { DevelopmentFixturePricingAdapter, DisabledPricingAdapter, type PricingPort } from './modules/booking/development-pricing-adapter.js';
import { registerDispatchRoutes } from './modules/dispatch/routes.js';
import { registerJourneyRoutes } from './modules/journey/routes.js';
import { registerSafetyRoutes } from './modules/safety/routes.js';
import { registerFinanceRoutes } from './modules/finance/routes.js';
import { registerDriverOperationsRoutes } from './modules/driver-operations/routes.js';
import { registerFleetOperationsRoutes } from './modules/fleet-operations/routes.js';
import { registerMaintenanceReliabilityRoutes } from './modules/maintenance-reliability/routes.js';
import { registerDriverFairTreatmentRoutes } from './modules/driver-fair-treatment/routes.js';
import { registerDriverDailyOperationsRoutes } from './modules/driver-daily-operations/routes.js';
import { registerCommunicationRoutes } from './modules/communications/routes.js';
import { registerTelephonyVoiceRoutes } from './modules/telephony-voice/routes.js';
import { registerCommunicationsOperationsRoutes } from './modules/communications-operations/routes.js';
import { registerCommunicationsClosureRoutes } from './modules/communications-closure/routes.js';
import { registerOrganisationOperationsRoutes } from './modules/organisation-operations/routes.js';
import { registerInstitutionalTransportRoutes } from './modules/institutional-transport/routes.js';
import { registerOrganisationCommercialOperationsRoutes } from './modules/organisation-commercial-operations/routes.js';
import { registerInstitutionalLiveOperationsRoutes } from './modules/institutional-live-operations/routes.js';

export interface ApiDependencies {
  readonly database: DatabasePool;
  readonly verificationDelivery?: ContactVerificationDeliveryPort | null;
  readonly pricing?: PricingPort;
}

function configuredVerificationDelivery(config: ApiConfig): ContactVerificationDeliveryPort | null {
  return config.verificationDeliveryMode === 'development_console'
    ? new DevelopmentConsoleVerificationDelivery(config.exposeDevelopmentVerificationCode)
    : null;
}

function configuredPricing(config: ApiConfig): PricingPort {
  return config.pricingMode === 'development_fixture'
    ? new DevelopmentFixturePricingAdapter(config.developmentQuoteAmountMinor!, config.developmentQuoteCurrency, config.quoteTtlMinutes)
    : new DisabledPricingAdapter();
}

export function buildApi(config: ApiConfig, dependencies: ApiDependencies): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });
  const { database } = dependencies;
  const verificationDelivery = dependencies.verificationDelivery === undefined
    ? configuredVerificationDelivery(config)
    : dependencies.verificationDelivery;
  const pricing = dependencies.pricing ?? configuredPricing(config);

  app.get('/health/live', async () => ({ status: 'LIVE' }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await database.query('SELECT 1');
      return reply.code(200).send({
        status: 'READY',
        dependencies: {
          database: 'READY',
          redis: 'NOT_REQUIRED_FOR_PHASE_0_20_INSTITUTIONAL_LIVE_OPERATIONS_FOUNDATION',
          verificationDelivery: config.verificationDeliveryMode.toUpperCase(),
          pricing: config.pricingMode.toUpperCase(),
          paymentProvider: config.paymentProviderMode.toUpperCase(),
          communicationProvider: config.communicationProviderMode.toUpperCase(),
          telephonyProvider: config.telephonyProviderMode.toUpperCase(),
          voiceAssistant: config.voiceAssistantMode.toUpperCase(),
          contactCentreMutation: config.contactCentreMutationMode.toUpperCase(),
          communicationsScenarioExecution: config.communicationsScenarioMode.toUpperCase(),
          communicationsClosureExecution: config.communicationsClosureMode.toUpperCase(),
          organisationMutation: config.organisationMutationMode.toUpperCase(),
          organisationIntegration: config.organisationIntegrationMode.toUpperCase(),
          institutionalTransportMutation: config.institutionalTransportMutationMode.toUpperCase(),
          organisationCommercialMutation: config.organisationCommercialMutationMode.toUpperCase(),
          institutionalLiveMutation: config.institutionalLiveMutationMode.toUpperCase()
        }
      });
    } catch {
      return reply.code(503).send({ status: 'NOT_READY', dependencies: { database: 'UNAVAILABLE' } });
    }
  });

  app.get('/v1/build-info', async () => ({
    product: 'DAZAT Mobility',
    checkpoint: 'engineering-phase-0.25',
    implementationStatus: 'API_BOOTSTRAP_TESTABLE_RUNTIME_CONTRACT_VERIFIED_PROVIDER_AND_OPERATIONAL_MUTATIONS_DISABLED'
  }));

  registerIdentityRoutes(app, database, config, verificationDelivery);
  registerBookingRoutes(app, database, pricing);
  registerDispatchRoutes(app, database, config);
  registerJourneyRoutes(app, database, config);
  registerSafetyRoutes(app, database);
  registerFinanceRoutes(app, database);
  registerDriverOperationsRoutes(app, database);
  registerFleetOperationsRoutes(app, database);
  registerMaintenanceReliabilityRoutes(app, database);
  registerDriverFairTreatmentRoutes(app, database);
  registerDriverDailyOperationsRoutes(app, database, config);
  registerCommunicationRoutes(app, database);
  registerTelephonyVoiceRoutes(app, database);
  registerCommunicationsOperationsRoutes(app, database);
  registerCommunicationsClosureRoutes(app, database);
  registerOrganisationOperationsRoutes(app, database);
  registerInstitutionalTransportRoutes(app, database);
  registerOrganisationCommercialOperationsRoutes(app, database);
  registerInstitutionalLiveOperationsRoutes(app, database);

  app.addHook('onClose', async () => {
    await database.end();
  });

  return app;
}
