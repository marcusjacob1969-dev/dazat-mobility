import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../../services/api/dist/config.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://configuration.invalid/dazat',
  REDIS_URL: 'redis://configuration.invalid',
  CONTACT_VERIFICATION_PEPPER: 'configuration-contact-pepper-32-characters',
  RIDECHECK_PEPPER: 'configuration-ridecheck-pepper-32-characters'
};

test('provider and delivery modes default to disabled', () => {
  const config = loadConfig(validEnvironment);
  assert.equal(config.verificationDeliveryMode, 'disabled');
  assert.equal(config.pricingMode, 'disabled');
  assert.equal(config.paymentProviderMode, 'disabled');
  assert.equal(config.communicationProviderMode, 'disabled');
  assert.equal(config.telephonyProviderMode, 'disabled');
  assert.equal(config.voiceAssistantMode, 'disabled');
});

test('development verification delivery requires an explicit mode', () => {
  const config = loadConfig({
    ...validEnvironment,
    VERIFICATION_DELIVERY_MODE: 'development_console',
    DAZAT_DEV_EXPOSE_VERIFICATION_CODE: 'true'
  });
  assert.equal(config.verificationDeliveryMode, 'development_console');
  assert.equal(config.exposeDevelopmentVerificationCode, true);
});

test('every unapproved provider or mutation mode fails closed', () => {
  const variables = [
    'PAYMENT_PROVIDER_MODE',
    'COMMUNICATION_PROVIDER_MODE',
    'TELEPHONY_PROVIDER_MODE',
    'VOICE_ASSISTANT_MODE',
    'CONTACT_CENTRE_MUTATION_MODE',
    'COMMUNICATIONS_SCENARIO_MODE',
    'COMMUNICATIONS_CLOSURE_MODE',
    'ORGANISATION_MUTATION_MODE',
    'ORGANISATION_INTEGRATION_MODE',
    'INSTITUTIONAL_TRANSPORT_MUTATION_MODE',
    'ORGANISATION_COMMERCIAL_MUTATION_MODE',
    'INSTITUTIONAL_LIVE_MUTATION_MODE'
  ];
  for (const variable of variables) {
    assert.throws(() => loadConfig({ ...validEnvironment, [variable]: 'enabled' }), new RegExp(variable));
  }
});

test('database, Redis and strong peppers are mandatory', () => {
  assert.throws(() => loadConfig({ ...validEnvironment, DATABASE_URL: undefined }), /DATABASE_URL is required/);
  assert.throws(() => loadConfig({ ...validEnvironment, REDIS_URL: undefined }), /REDIS_URL is required/);
  assert.throws(() => loadConfig({ ...validEnvironment, CONTACT_VERIFICATION_PEPPER: 'short' }), /CONTACT_VERIFICATION_PEPPER/);
  assert.throws(() => loadConfig({ ...validEnvironment, RIDECHECK_PEPPER: 'short' }), /RIDECHECK_PEPPER/);
});

test('development pricing requires safe integer minor units', () => {
  assert.throws(() => loadConfig({ ...validEnvironment, PRICING_MODE: 'development_fixture' }), /DEVELOPMENT_QUOTE_AMOUNT_MINOR/);
  assert.throws(() => loadConfig({
    ...validEnvironment,
    PRICING_MODE: 'development_fixture',
    DEVELOPMENT_QUOTE_AMOUNT_MINOR: '1.5'
  }), /DEVELOPMENT_QUOTE_AMOUNT_MINOR/);
  const config = loadConfig({
    ...validEnvironment,
    PRICING_MODE: 'development_fixture',
    DEVELOPMENT_QUOTE_AMOUNT_MINOR: '2500',
    DEVELOPMENT_QUOTE_CURRENCY: 'gbp'
  });
  assert.equal(config.developmentQuoteAmountMinor, 2500);
  assert.equal(config.developmentQuoteCurrency, 'GBP');
});

test('safety-critical numeric bounds reject invalid values', () => {
  assert.throws(() => loadConfig({ ...validEnvironment, API_PORT: '0' }), /Invalid API_PORT/);
  assert.throws(() => loadConfig({ ...validEnvironment, RIDECHECK_MAXIMUM_ATTEMPTS: '0' }), /Invalid RIDECHECK_MAXIMUM_ATTEMPTS/);
  assert.throws(() => loadConfig({ ...validEnvironment, JOURNEY_LOCATION_MINIMUM_CONFIDENCE: '1.1' }), /JOURNEY_LOCATION_MINIMUM_CONFIDENCE/);
  assert.throws(() => loadConfig({ ...validEnvironment, DISPATCH_MINIMUM_LOCATION_CONFIDENCE: '-0.1' }), /DISPATCH_MINIMUM_LOCATION_CONFIDENCE/);
});
