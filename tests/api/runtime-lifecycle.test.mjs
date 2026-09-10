import assert from 'node:assert/strict';
import test from 'node:test';
import { installGracefulShutdown } from '../../services/api/dist/runtime-lifecycle.js';

function fixture(close) {
  const listeners = new Map();
  const records = [];
  const runtime = {
    exitCode: undefined,
    once(event, listener) { listeners.set(event, listener); }
  };
  const app = {
    close,
    log: {
      info(value, message) { records.push({ level: 'info', value, message }); },
      error(value, message) { records.push({ level: 'error', value, message }); }
    }
  };
  return { app, runtime, listeners, records };
}

test('SIGTERM and SIGINT install one graceful Fastify shutdown boundary', async () => {
  let closes = 0;
  const state = fixture(async () => { closes += 1; });
  const shutdown = installGracefulShutdown(state.app, state.runtime);
  assert.deepEqual([...state.listeners.keys()], ['SIGTERM', 'SIGINT']);
  const first = shutdown('SIGTERM');
  const replay = shutdown('SIGINT');
  assert.equal(first, replay);
  await first;
  assert.equal(closes, 1);
  assert.equal(state.runtime.exitCode, undefined);
  assert.equal(state.records[0].value.signal, 'SIGTERM');
});

test('graceful shutdown failure is logged and sets a failing process exit code', async () => {
  const failure = new Error('close failed');
  const state = fixture(async () => { throw failure; });
  await installGracefulShutdown(state.app, state.runtime)('SIGTERM');
  assert.equal(state.runtime.exitCode, 1);
  assert.equal(state.records.at(-1).level, 'error');
  assert.equal(state.records.at(-1).value.err, failure);
});
