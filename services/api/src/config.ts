export interface ApiConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly logLevel: string;
  readonly contactVerificationPepper: string;
  readonly contactVerificationTtlMinutes: number;
  readonly contactVerificationResendSeconds: number;
  readonly contactVerificationMaxAttempts: number;
  readonly verificationDeliveryMode: 'development_console' | 'disabled';
  readonly exposeDevelopmentVerificationCode: boolean;
  readonly sessionTtlMinutes: number;
  readonly pricingMode: 'disabled' | 'development_fixture';
  readonly developmentQuoteAmountMinor?: number;
  readonly developmentQuoteCurrency: string;
  readonly quoteTtlMinutes: number;
  readonly dispatchOfferTtlSeconds: number;
  readonly dispatchOfferWaveSize: number;
  readonly dispatchLocationMaxAgeSeconds: number;
  readonly dispatchMinimumLocationConfidence: number;
  readonly journeyLocationMaxAgeSeconds: number;
  readonly journeyLocationMaximumFutureSkewSeconds: number;
  readonly journeyLocationMaximumAccuracyMetres: number;
  readonly journeyLocationMinimumConfidence: number;
  readonly journeyArrivalRadiusMetres: number;
  readonly rideCheckPepper: string;
  readonly rideCheckTtlMinutes: number;
  readonly rideCheckMaximumAttempts: number;
  readonly activeJourneyMaximumPlausibleSpeedMetresPerSecond: number;
  readonly journeyArrivingRadiusMetres: number;
  readonly journeyCompletionRadiusMetres: number;
  readonly paymentProviderMode: 'disabled';
  readonly driverConnectivityFreshnessSeconds: number;
  readonly communicationProviderMode: 'disabled';
  readonly telephonyProviderMode: 'disabled';
  readonly voiceAssistantMode: 'disabled';
  readonly contactCentreMutationMode: 'disabled';
  readonly communicationsScenarioMode: 'disabled';
  readonly communicationsClosureMode: 'disabled';
  readonly organisationMutationMode: 'disabled';
  readonly organisationIntegrationMode: 'disabled';
  readonly institutionalTransportMutationMode: 'disabled';
}

function parseInteger(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const value = Number(env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = parseInteger(env, 'API_PORT', 3001, 1, 65535);
  const databaseUrl = env.DATABASE_URL;
  const redisUrl = env.REDIS_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!redisUrl) throw new Error('REDIS_URL is required');

  const contactVerificationPepper = env.CONTACT_VERIFICATION_PEPPER;
  if (!contactVerificationPepper || contactVerificationPepper.length < 32) {
    throw new Error('CONTACT_VERIFICATION_PEPPER of at least 32 characters is required');
  }
  const rideCheckPepper = env.RIDECHECK_PEPPER;
  if (!rideCheckPepper || rideCheckPepper.length < 32) {
    throw new Error('RIDECHECK_PEPPER of at least 32 characters is required');
  }

  const verificationDeliveryMode = env.VERIFICATION_DELIVERY_MODE === 'disabled'
    ? 'disabled'
    : 'development_console';
  const pricingMode = env.PRICING_MODE === 'development_fixture' ? 'development_fixture' : 'disabled';
  if (env.PAYMENT_PROVIDER_MODE && env.PAYMENT_PROVIDER_MODE !== 'disabled') {
    throw new Error('PAYMENT_PROVIDER_MODE must remain disabled until a provider and production controls are approved');
  }
  if (env.COMMUNICATION_PROVIDER_MODE && env.COMMUNICATION_PROVIDER_MODE !== 'disabled') {
    throw new Error('COMMUNICATION_PROVIDER_MODE must remain disabled until providers and production controls are approved');
  }
  if (env.TELEPHONY_PROVIDER_MODE && env.TELEPHONY_PROVIDER_MODE !== 'disabled') {
    throw new Error('TELEPHONY_PROVIDER_MODE must remain disabled until telephony and operational controls are approved');
  }
  if (env.VOICE_ASSISTANT_MODE && env.VOICE_ASSISTANT_MODE !== 'disabled') {
    throw new Error('VOICE_ASSISTANT_MODE must remain disabled until voice safety, accessibility and operational controls are approved');
  }
  if (env.CONTACT_CENTRE_MUTATION_MODE && env.CONTACT_CENTRE_MUTATION_MODE !== 'disabled') {
    throw new Error('CONTACT_CENTRE_MUTATION_MODE must remain disabled until staff authority and operational controls are approved');
  }
  if (env.COMMUNICATIONS_SCENARIO_MODE && env.COMMUNICATIONS_SCENARIO_MODE !== 'disabled') {
    throw new Error('COMMUNICATIONS_SCENARIO_MODE must remain disabled until isolated fixtures and acceptance controls are approved');
  }
  if (env.COMMUNICATIONS_CLOSURE_MODE && env.COMMUNICATIONS_CLOSURE_MODE !== 'disabled') {
    throw new Error('COMMUNICATIONS_CLOSURE_MODE must remain disabled until every launch gate and accountable approval passes');
  }
  if (env.ORGANISATION_MUTATION_MODE && env.ORGANISATION_MUTATION_MODE !== 'disabled') {
    throw new Error('ORGANISATION_MUTATION_MODE must remain disabled until staff authority and operational controls are approved');
  }
  if (env.ORGANISATION_INTEGRATION_MODE && env.ORGANISATION_INTEGRATION_MODE !== 'disabled') {
    throw new Error('ORGANISATION_INTEGRATION_MODE must remain disabled until tenant-scoped credentials, signing and operational controls are approved');
  }
  if (env.INSTITUTIONAL_TRANSPORT_MUTATION_MODE && env.INSTITUTIONAL_TRANSPORT_MUTATION_MODE !== 'disabled') {
    throw new Error('INSTITUTIONAL_TRANSPORT_MUTATION_MODE must remain disabled until passenger, recurring, bulk and exception operational controls are approved');
  }
  let developmentQuoteAmountMinor: number | undefined;
  if (pricingMode === 'development_fixture') {
    const raw = env.DEVELOPMENT_QUOTE_AMOUNT_MINOR;
    if (!raw || !/^\d+$/.test(raw)) throw new Error('DEVELOPMENT_QUOTE_AMOUNT_MINOR is required in development_fixture pricing mode');
    developmentQuoteAmountMinor = Number(raw);
    if (!Number.isSafeInteger(developmentQuoteAmountMinor) || developmentQuoteAmountMinor < 0) {
      throw new Error('Invalid DEVELOPMENT_QUOTE_AMOUNT_MINOR');
    }
  }

  return {
    port,
    databaseUrl,
    redisUrl,
    logLevel: env.LOG_LEVEL ?? 'info',
    contactVerificationPepper,
    contactVerificationTtlMinutes: parseInteger(env, 'CONTACT_VERIFICATION_TTL_MINUTES', 10, 1, 30),
    contactVerificationResendSeconds: parseInteger(env, 'CONTACT_VERIFICATION_RESEND_SECONDS', 30, 10, 600),
    contactVerificationMaxAttempts: parseInteger(env, 'CONTACT_VERIFICATION_MAX_ATTEMPTS', 5, 1, 10),
    verificationDeliveryMode,
    exposeDevelopmentVerificationCode: parseBoolean(env.DAZAT_DEV_EXPOSE_VERIFICATION_CODE),
    sessionTtlMinutes: parseInteger(env, 'SESSION_TTL_MINUTES', 60, 5, 1440),
    pricingMode,
    ...(developmentQuoteAmountMinor !== undefined ? { developmentQuoteAmountMinor } : {}),
    developmentQuoteCurrency: (env.DEVELOPMENT_QUOTE_CURRENCY ?? 'GBP').toUpperCase(),
    quoteTtlMinutes: parseInteger(env, 'QUOTE_TTL_MINUTES', 15, 1, 120),
    dispatchOfferTtlSeconds: parseInteger(env, 'DISPATCH_OFFER_TTL_SECONDS', 30, 10, 180),
    dispatchOfferWaveSize: parseInteger(env, 'DISPATCH_OFFER_WAVE_SIZE', 3, 1, 20),
    dispatchLocationMaxAgeSeconds: parseInteger(env, 'DISPATCH_LOCATION_MAX_AGE_SECONDS', 90, 15, 600),
    dispatchMinimumLocationConfidence: (() => {
      const value = Number(env.DISPATCH_MINIMUM_LOCATION_CONFIDENCE ?? '0.5');
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid DISPATCH_MINIMUM_LOCATION_CONFIDENCE');
      return value;
    })(),
    journeyLocationMaxAgeSeconds: parseInteger(env, 'JOURNEY_LOCATION_MAX_AGE_SECONDS', 60, 10, 600),
    journeyLocationMaximumFutureSkewSeconds: parseInteger(env, 'JOURNEY_LOCATION_MAXIMUM_FUTURE_SKEW_SECONDS', 15, 0, 120),
    journeyLocationMaximumAccuracyMetres: parseInteger(env, 'JOURNEY_LOCATION_MAXIMUM_ACCURACY_METRES', 75, 5, 1_000),
    journeyLocationMinimumConfidence: (() => {
      const value = Number(env.JOURNEY_LOCATION_MINIMUM_CONFIDENCE ?? '0.7');
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid JOURNEY_LOCATION_MINIMUM_CONFIDENCE');
      return value;
    })(),
    journeyArrivalRadiusMetres: parseInteger(env, 'JOURNEY_ARRIVAL_RADIUS_METRES', 200, 25, 2_000),
    rideCheckPepper,
    rideCheckTtlMinutes: parseInteger(env, 'RIDECHECK_TTL_MINUTES', 10, 1, 30),
    rideCheckMaximumAttempts: parseInteger(env, 'RIDECHECK_MAXIMUM_ATTEMPTS', 5, 1, 10),
    activeJourneyMaximumPlausibleSpeedMetresPerSecond: parseInteger(env, 'ACTIVE_JOURNEY_MAXIMUM_PLAUSIBLE_SPEED_MPS', 75, 10, 150),
    journeyArrivingRadiusMetres: parseInteger(env, 'JOURNEY_ARRIVING_RADIUS_METRES', 1_000, 100, 5_000),
    journeyCompletionRadiusMetres: parseInteger(env, 'JOURNEY_COMPLETION_RADIUS_METRES', 250, 25, 2_000),
    paymentProviderMode: 'disabled',
    driverConnectivityFreshnessSeconds: parseInteger(env, 'DRIVER_CONNECTIVITY_FRESHNESS_SECONDS', 60, 10, 600),
    communicationProviderMode: 'disabled',
    telephonyProviderMode: 'disabled',
    voiceAssistantMode: 'disabled',
    contactCentreMutationMode: 'disabled',
    communicationsScenarioMode: 'disabled',
    communicationsClosureMode: 'disabled',
    organisationMutationMode: 'disabled',
    organisationIntegrationMode: 'disabled',
    institutionalTransportMutationMode: 'disabled'
  };
}
