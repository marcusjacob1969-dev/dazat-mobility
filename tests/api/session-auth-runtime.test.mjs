import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateBearerSession } from '../../services/api/dist/modules/identity/session-service.js';

const validToken = `dzs_${'a'.repeat(43)}`;

function sessionRow(overrides = {}) {
  return {
    session_id: '00000000-0000-4000-8000-000000000001',
    session_status: 'ACTIVE',
    auth_strength: 'VERIFIED_CONTACT',
    expires_at: new Date(Date.now() + 60_000),
    account_id: '00000000-0000-4000-8000-000000000002',
    account_status: 'ACTIVE',
    person_id: '00000000-0000-4000-8000-000000000003',
    rider_profile_id: '00000000-0000-4000-8000-000000000004',
    driver_profile_id: null,
    ...overrides
  };
}

test('malformed bearer tokens fail before database access', async () => {
  let queryCount = 0;
  const database = {
    query: async () => {
      queryCount += 1;
      throw new Error('database must not be queried');
    },
    end: async () => {}
  };
  assert.equal(await authenticateBearerSession(database, 'not-a-dazat-token'), null);
  assert.equal(queryCount, 0);
});

test('authoritative bearer authentication queries only a token hash and updates last seen', async () => {
  const calls = [];
  const database = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM identity.session')) return { rowCount: 1, rows: [sessionRow()] };
      if (sql.includes('UPDATE identity.session SET last_seen_at')) return { rowCount: 1, rows: [] };
      throw new Error('unexpected query');
    },
    end: async () => {}
  };
  const principal = await authenticateBearerSession(database, validToken, 'BOOK_RIDE');
  assert.equal(principal?.accountStatus, 'ACTIVE');
  assert.equal(principal?.riderProfileId, '00000000-0000-4000-8000-000000000004');
  assert.equal(calls.length, 2);
  assert.match(calls[0].params[0], /^[a-f0-9]{64}$/);
  assert.notEqual(calls[0].params[0], validToken);
  assert.equal(JSON.stringify(calls).includes(validToken), false);
  assert.match(calls[1].sql, /last_seen_at/);
});

test('revoked and expired sessions fail closed without updating last seen', async (t) => {
  for (const [name, row] of [
    ['revoked', sessionRow({ session_status: 'REVOKED' })],
    ['expired', sessionRow({ expires_at: new Date(Date.now() - 60_000) })]
  ]) {
    await t.test(name, async () => {
      let queryCount = 0;
      const database = {
        query: async () => {
          queryCount += 1;
          return { rowCount: 1, rows: [row] };
        },
        end: async () => {}
      };
      assert.equal(await authenticateBearerSession(database, validToken), null);
      assert.equal(queryCount, 1);
    });
  }
});

test('account capability denial fails closed without updating last seen', async () => {
  let queryCount = 0;
  const database = {
    query: async () => {
      queryCount += 1;
      return { rowCount: 1, rows: [sessionRow({ account_status: 'SUSPENDED' })] };
    },
    end: async () => {}
  };
  assert.equal(await authenticateBearerSession(database, validToken, 'BOOK_RIDE'), null);
  assert.equal(queryCount, 1);
});
