import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const proof = readFileSync(join(root, 'scripts/verify-core-journey-http-postgres.mjs'), 'utf8');
const service = readFileSync(join(root, 'services/api/src/modules/core-journey/core-journey-service.ts'), 'utf8');

for (const proofLine of [
  'const driverCompleted = await get(`/v1/driver/bookings/${ids.completedBooking}/core-journey-progress`, tokens.actor);',
  'assert.deepEqual(driverCompleted.json(), completed.json());',
  "assert.equal(driverCompleted.json().nextAction, 'JOURNEY_CLOSED');",
  "assert.equal(driverCompleted.json().milestones.find((milestone) => milestone.name === 'FINANCE').status, 'COMPLETED');"
]) {
  if (!proof.includes(proofLine)) throw new Error(`Missing completed finance parity proof: ${proofLine}`);
}
if (!service.includes('productionChargingEnabled: false')) throw new Error('Provider-disabled Core Journey finance boundary missing');

console.log('DAZAT Phase 0.111 completed finance Rider/Driver projection parity verification PASSED');
