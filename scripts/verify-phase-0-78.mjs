import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const app = readFileSync(join(root, 'services/api/src/app.ts'), 'utf8');
const errors = [];
for (const truth of [
  '/payment-intents`, registeredToken', 'preparedPaymentReplay.json(), preparedPayment.json()',
  '/v1/payments/${preparedPayment.json().paymentIntentId}/status', "chargingEligibility, 'NOT_ELIGIBLE'",
  'providerActionAttempted, false', 'blindRetryAllowed, false', "'FINANCE_FORBIDDEN'",
  "'RECEIPT_NOT_READY'", "paymentIntentStatus, 'CREATED'", "nextAction, 'PAYMENT_PROVIDER_UNAVAILABLE'"
]) if (!runner.includes(truth)) errors.push(`Finance handoff HTTP verifier missing: ${truth}`);
const checkpoint = app.match(/checkpoint: 'engineering-phase-0\.(\d+)'/)?.[1];
if (!checkpoint || Number(checkpoint) < 78) errors.push('Build metadata predates Phase 0.78');
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.78 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.78 verification PASSED');
