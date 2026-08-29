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
    rideCheckMaximumAttempts: parseInteger(env, 'RIDECHECK_MAXIMUM_ATTEMPTS', 5, 1, 10)
  };
}
