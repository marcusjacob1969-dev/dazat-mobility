import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = {
  contract: readFileSync(join(root, 'packages/contracts/src/core-journey-progress.ts'), 'utf8'),
  openapi: readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8'),
  rider: readFileSync(join(root, 'apps/rider/App.tsx'), 'utf8'),
  docs: readFileSync(join(root, 'docs/engineering/phase-0.79-rider-finance-boundary-ui.md'), 'utf8')
};
const errors = [];
for (const [label, source] of Object.entries(files)) {
  if (!source.includes('PAYMENT_PROVIDER_UNAVAILABLE')) errors.push(`${label} omits provider-unavailable truth`);
}
for (const truth of ['Promise.all([', 'readPaymentStatus(sessionToken, intent.paymentIntentId)', 'readCoreJourneyProgress(sessionToken, booking.bookingId)', 'no charge attempted']) {
  if (!files.rider.includes(truth)) errors.push(`Rider Finance boundary missing: ${truth}`);
}
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.79 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.79 verification PASSED');
