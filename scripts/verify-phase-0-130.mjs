import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../database/migrations/0033_payment_capture_timestamp.sql', import.meta.url), 'utf8');
const service = readFileSync(new URL('../services/api/src/modules/finance/finance-service.ts', import.meta.url), 'utf8');

for (const marker of [
  'ADD COLUMN IF NOT EXISTS captured_at timestamptz',
  'finance.guard_payment_capture_timestamp()',
  'Captured payment state requires captured_at',
  'Uncaptured payment state cannot have captured_at',
  'CREATE TRIGGER payment_capture_timestamp_guard',
  "SET captured_at = COALESCE(provider_created_at, updated_at)"
]) assert.ok(migration.includes(marker), marker);

assert.ok(service.includes('p.captured_at'), 'Receipt service must use captured_at');
assert.equal(service.includes('COALESCE(p.provider_created_at, p.updated_at) AS captured_at'), false);

console.log('DAZAT Phase 0.130 authoritative payment capture timestamp verification PASSED');
