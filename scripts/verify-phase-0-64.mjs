import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const contract = readFileSync(join(root, 'packages/contracts/src/core-journey-progress.ts'), 'utf8');
const service = readFileSync(join(root, 'services/api/src/modules/core-journey/core-journey-service.ts'), 'utf8');
const openapi = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
const errors = [];
if (!contract.includes("import type { BookingStatus } from '@dazat/domain'")) errors.push('Contract does not import authoritative BookingStatus');
if (!contract.includes('readonly bookingStatus: BookingStatus')) errors.push('Projection bookingStatus remains unconstrained');
if (!service.includes('booking_status: BookingStatus')) errors.push('Persistence row booking status remains unconstrained');
for (const status of ['QUOTE_CREATED', 'ACTIVE_INCIDENT', 'REPLACEMENT_SEARCHING', 'REFUNDED']) if (!openapi.includes(status)) errors.push(`OpenAPI Booking status missing: ${status}`);
if (errors.length) { console.error('DAZAT Engineering Phase 0.64 verification FAILED'); for (const error of errors) console.error(`- ${error}`); process.exit(1); }
console.log('DAZAT Engineering Phase 0.64 verification PASSED');
