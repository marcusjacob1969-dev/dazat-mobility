import assert from 'node:assert/strict';
import test from 'node:test';
import { bearerTokenFromAuthorization } from '../../services/api/dist/security/bearer-token.js';

test('bearer parsing accepts the case-insensitive standard scheme', () => {
  assert.equal(bearerTokenFromAuthorization('Bearer dzs_token'), 'dzs_token');
  assert.equal(bearerTokenFromAuthorization('bearer dzs_token'), 'dzs_token');
  assert.equal(bearerTokenFromAuthorization('BEARER\tdzs_token'), 'dzs_token');
});

test('bearer parsing rejects missing empty ambiguous and multi-value credentials', () => {
  for (const value of [
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Basic dzs_token',
    'Bearer first, Bearer second',
    'Bearer token with-space',
    'Bearer token,second'
  ]) {
    assert.equal(bearerTokenFromAuthorization(value), null);
  }
});

test('bearer parsing rejects oversized credential headers', () => {
  assert.equal(bearerTokenFromAuthorization(`Bearer ${'x'.repeat(506)}`), null);
});
