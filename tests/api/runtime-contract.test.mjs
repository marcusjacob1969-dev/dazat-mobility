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
  assert.equal(build.json().checkpoint, 'engineering-phase-0.25');

  await app.close();
  assert.equal(dependency.closeCount(), 1);
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
