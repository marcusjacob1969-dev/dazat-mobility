import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rider = readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8');
const financeApi = readFileSync(join(root, 'apps/rider/src/finance-api.ts'), 'utf8');
const financeService = readFileSync(join(root, 'services/api/src/modules/finance/finance-service.ts'), 'utf8');

for (const required of [
  'ReceiptProjection',
  'readReceipt',
  'useState<ReceiptProjection | null>',
  'async function refreshReceipt()',
  'Check receipt availability',
  'canonical Finance truth only after a captured Payment exists'
]) {
  if (!rider.includes(required)) throw new Error(`Rider receipt surface binding missing: ${required}`);
}
if (!financeApi.includes("/v1/receipts/${bookingId}")) throw new Error('Rider receipt API route binding missing');
if (!financeService.includes('No captured Payment exists; a receipt cannot be issued')) throw new Error('Canonical receipt readiness boundary missing');

console.log('DAZAT Phase 0.112 Rider canonical receipt surface verification PASSED');
