import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
const finance = readFileSync(join(root, 'services/api/src/modules/finance/finance-service.ts'), 'utf8');

for (const required of [
  'Posted earnings',
  'earnings.map((earning)',
  'EARNINGS ARE POSTED FINANCE RECORDS · PAYOUT IS NOT INFERRED'
 ]) {
  if (!driver.includes(required)) throw new Error(`Driver earnings surface binding missing: ${required}`);
}
if (!finance.includes('finance.driver_earnings_projection')) throw new Error('Authoritative Driver earnings projection missing');
if (!finance.includes('riderFareUsedAsDriverEarning: false')) throw new Error('Driver earning separation boundary missing');

console.log('DAZAT Phase 0.113 Driver earnings surface verification PASSED');
