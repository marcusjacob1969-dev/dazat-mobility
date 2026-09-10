import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const demo = readFileSync(join(root, 'scripts/demo-core-journey.mjs'), 'utf8');
const errors = [];
for (const truth of ['providerDisabledFinanceProgress', "payment_intent_status: 'CREATED'", "'PAYMENT_PROVIDER_UNAVAILABLE'", "name === 'FINANCE').status, 'BLOCKED'", "checkpoint: 'engineering-phase-0.80'"]) {
  if (!demo.includes(truth)) errors.push(`Finance demo truth missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.80 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.80 verification PASSED');
