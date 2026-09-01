import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApi } from '../../services/api/dist/app.js';
import { loadConfig } from '../../services/api/dist/config.js';

const config = loadConfig({
  DATABASE_URL: 'postgresql://runtime-contract.invalid/dazat',
  REDIS_URL: 'redis://runtime-contract.invalid',
  CONTACT_VERIFICATION_PEPPER: 'runtime-contract-contact-pepper-32-characters',
  RIDECHECK_PEPPER: 'runtime-contract-ridecheck-pepper-32-characters',
  VERIFICATION_DELIVERY_MODE: 'disabled',
  LOG_LEVEL: 'silent'
});

function databaseDouble(query) {
  let closeCount = 0;
  const database = {
    query,
    end: async () => { closeCount += 1; }
  };
  return { database, closeCount: () => closeCount };
}

test('liveness and build metadata do not depend on database availability', async () => {
  const dependency = databaseDouble(async () => { throw new Error('database unavailable'); });
  const app = buildApi(config, { database: dependency.database });

  const live = await app.inject({ method: 'GET', url: '/health/live' });
  assert.equal(live.statusCode, 200);
  assert.deepEqual(live.json(), { status: 'LIVE' });

  const build = await app.inject({ method: 'GET', url: '/v1/build-info' });
  assert.equal(build.statusCode, 200);
  assert.equal(build.json().checkpoint, 'engineering-phase-0.29');
  assert.equal(build.headers['cache-control'], 'no-store');
  assert.equal(build.headers['x-content-type-options'], 'nosniff');
  assert.equal(build.headers['x-frame-options'], 'DENY');
  assert.match(build.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(build.headers['x-request-id'], /^req-/);

  await app.close();
  assert.equal(dependency.closeCount(), 1);
});

test('oversized request bodies are rejected before domain handling', async () => {
  const dependency = databaseDouble(async () => { throw new Error('database must not be reached'); });
  const app = buildApi(config, { database: dependency.database });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/identity/registrations',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'oversized-contract' },
    payload: JSON.stringify({ padding: 'x'.repeat(1_048_576) })
  });
  assert.equal(response.statusCode, 413);
  assert.deepEqual(response.json(), {
    code: 'REQUEST_BODY_TOO_LARGE',
    message: 'The request body exceeds the permitted size.'
  });
  assert.equal(response.headers['cache-control'], 'no-store');
  await app.close();
});

test('unknown routes use a privacy-safe contract and ignore supplied request IDs', async () => {
  const dependency = databaseDouble(async () => ({ rows: [] }));
  const app = buildApi(config, { database: dependency.database });
  const response = await app.inject({
    method: 'GET',
    url: '/v1/not-a-real-route?secret=must-not-be-returned',
    headers: { 'x-request-id': 'attacker-controlled-id' }
  });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    code: 'ROUTE_NOT_FOUND',
    message: 'The requested DAZAT API route does not exist.'
  });
  assert.notEqual(response.headers['x-request-id'], 'attacker-controlled-id');
  assert.equal(response.body.includes('secret'), false);
  await app.close();
});

test('malformed JSON uses the stable client-error contract without reflecting input', async () => {
  const dependency = databaseDouble(async () => { throw new Error('database must not be reached'); });
  const app = buildApi(config, { database: dependency.database });
  const response = await app.inject({
    method: 'POST',
    url: '/v1/identity/registrations',
    headers: { 'content-type': 'application/json' },
    payload: '{"secret":"must-not-be-returned"'
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: 'REQUEST_REJECTED',
    message: 'The request could not be accepted.'
  });
  assert.equal(response.body.includes('secret'), false);
  assert.match(response.headers['x-request-id'], /^req-/);
  await app.close();
});

test('unexpected server failures use a stable contract without leaking error details', async () => {
  const dependency = databaseDouble(async () => ({ rows: [] }));
  const app = buildApi(config, { database: dependency.database });
  app.get('/__phase-0-29/unhandled-error-contract', async () => {
    throw new Error('credential host and stack detail must stay private');
  });
  const response = await app.inject({
    method: 'GET',
    url: '/__phase-0-29/unhandled-error-contract'
  });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'The request could not be completed.'
  });
  assert.equal(response.body.includes('credential'), false);
  assert.match(response.headers['x-request-id'], /^req-/);
  await app.close();
});

test('server-owned correlation IDs are unique between requests', async () => {
  const dependency = databaseDouble(async () => ({ rows: [] }));
  const app = buildApi(config, { database: dependency.database });
  const first = await app.inject({ method: 'GET', url: '/health/live' });
  const second = await app.inject({ method: 'GET', url: '/health/live' });
  assert.match(first.headers['x-request-id'], /^req-/);
  assert.match(second.headers['x-request-id'], /^req-/);
  assert.notEqual(first.headers['x-request-id'], second.headers['x-request-id']);
  await app.close();
});

test('readiness reports the database dependency as ready after a successful probe', async () => {
  const dependency = databaseDouble(async () => ({ rows: [{ '?column?': 1 }] }));
  const app = buildApi(config, { database: dependency.database });

  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, 'READY');
  assert.equal(body.dependencies.database, 'READY');
  assert.equal(body.dependencies.paymentProvider, 'DISABLED');
  assert.equal(body.dependencies.institutionalLiveMutation, 'DISABLED');

  await app.close();
  assert.equal(dependency.closeCount(), 1);
});

test('readiness fails closed without leaking the database error', async () => {
  const dependency = databaseDouble(async () => { throw new Error('credential and host detail must stay private'); });
  const app = buildApi(config, { database: dependency.database });

  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), {
    status: 'NOT_READY',
    dependencies: { database: 'UNAVAILABLE' }
  });
  assert.equal(response.body.includes('credential'), false);

  await app.close();
  assert.equal(dependency.closeCount(), 1);
});
