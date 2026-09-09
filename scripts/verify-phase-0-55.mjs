import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
const errors = [];
for (const truth of [
  '/v1/bookings/{bookingId}/core-journey-progress:',
  '/v1/driver/bookings/{bookingId}/core-journey-progress:',
  'CoreJourneyProgressProjection:',
  'CoreJourneyMilestone:',
  'productionChargingEnabled: { type: boolean, const: false }',
  'minItems: 8, maxItems: 8'
]) if (!source.includes(truth)) errors.push(`OpenAPI core-journey contract missing: ${truth}`);
if (errors.length) {
  console.error('DAZAT Engineering Phase 0.55 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.55 verification PASSED');
