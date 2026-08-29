import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0009_fleet_marketplace_agreement_assignment_foundation.sql',
  'packages/domain/src/fleet-operations.ts',
  'packages/contracts/src/fleet-operations.ts',
  'services/api/src/modules/fleet-operations/fleet-operations-service.ts',
  'services/api/src/modules/fleet-operations/routes.ts',
  'apps/driver/src/fleet-operations-api.ts',
  'docs/architecture/ADR-0009-fleet-marketplace-agreement-assignment-truth.md',
  'docs/engineering/phase-0-9-checklist.md',
  'docs/traceability/phase-0-9-requirements.md',
  'tests/domain/fleet-operations-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.9 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = existsSync(join(root, required[0])) ? readFileSync(join(root, required[0]), 'utf8') : '';
for (const object of [
  'vehicle_fleet.fleet_organisation', 'vehicle_fleet.vehicle_tenancy', 'vehicle_fleet.vehicle_state_transition',
  'vehicle_fleet.vehicle_capability_snapshot', 'vehicle_fleet.current_vehicle_capability',
  'vehicle_fleet.marketplace_offer', 'vehicle_fleet.current_marketplace_offer',
  'compliance.driver_vehicle_insurance_validation', 'compliance.current_driver_vehicle_insurance',
  'driver.current_driver_vehicle_authorisation', 'vehicle_fleet.fleet_agreement',
  'vehicle_fleet.fleet_agreement_version', 'vehicle_fleet.current_fleet_agreement',
  'vehicle_fleet.vehicle_finance_agreement', 'vehicle_fleet.vehicle_finance_agreement_version',
  'vehicle_fleet.deposit_obligation', 'vehicle_fleet.deposit_obligation_transition',
  'vehicle_fleet.deposit_deduction_proposal', 'vehicle_fleet.deposit_deduction_transition',
  'vehicle_fleet.vehicle_handover_record', 'vehicle_fleet.vehicle_assignment_validation_snapshot',
  'vehicle_fleet.vehicle_assignment', 'vehicle_fleet.vehicle_assignment_transition', 'vehicle_fleet.outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.9 persistence object: ${object}`);

for (const guarantee of [
  "'DRIVER_OWNED','WEEKLY_RENT','RENT_TO_OWN','FIXED_TERM_LEASE','LEASE_TO_OWN'",
  "'AVAILABLE','RESERVED','ASSIGNED','IN_SERVICE','MAINTENANCE','REPAIR'",
  'FleetVehicle current state requires matching append-only transition history',
  'Body style is informational and cannot infer WAV, school, executive, airport or capacity truth',
  'generic_discount_claim boolean NOT NULL DEFAULT false CHECK (generic_discount_claim = false)',
  "access_route NOT IN ('RENT_TO_OWN','LEASE_TO_OWN') OR COALESCE(cardinality(ownership_transfer_terms), 0) > 0",
  'supplier_stock_verified_at IS NOT NULL', 'warranty_verified_at IS NOT NULL',
  'is_platform_revenue boolean NOT NULL DEFAULT false CHECK (is_platform_revenue = false)',
  'Deposit deduction cannot exceed the recorded deposit obligation',
  'Deposit obligation current state requires matching append-only transition history',
  'Deposit deduction current state requires matching append-only transition history',
  'Vehicle assignment current state requires matching append-only transition history',
  'driver.current_driver_vehicle_authorisation', "insurance.status = 'ELIGIBLE'",
  'external_tenancy_bypass_allowed boolean NOT NULL DEFAULT false CHECK (external_tenancy_bypass_allowed = false)',
  'fleet_state_assignable boolean NOT NULL',
  'AND (NOT external_tenancy OR fleet_organisation_active)',
  'Replacement assignment must re-run validation for the replaced assignment'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.9 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/fleet-operations.ts'), 'utf8');
for (const guard of [
  'canTransitionFleetVehicleState', 'evaluateMarketplacePublication', 'genericDiscountClaimAllowed: false',
  'vehicleCapabilitiesAreExplicitAndVerified', 'depositDeductionMayAdvance',
  'evaluateVehicleAssignmentPermission', 'DRIVER_VEHICLE_INSURANCE_NOT_CURRENT',
  'VEHICLE_CAPABILITIES_NOT_EXPLICIT_OR_CURRENT', 'EXTERNAL_FLEET_ORGANISATION_NOT_ACTIVE',
  'externalTenancyBypassAllowed: false', 'replacementRequiresFreshValidation: true',
  'VEHICLE_CAPABILITY_MAY_BE_INFERRED_FROM_BODY_STYLE = false', 'GENERIC_FLEET_DISCOUNT_CLAIM_ALLOWED = false'
]) if (!domain.includes(guard)) errors.push(`Missing Fleet domain guard: ${guard}`);

const service = readFileSync(join(root, 'services/api/src/modules/fleet-operations/fleet-operations-service.ts'), 'utf8');
for (const guard of [
  'vehicle_fleet.current_marketplace_offer', 'genericDiscountClaim: false',
  'depositIsPlatformRevenue: false', 'driver.current_driver_vehicle_authorisation',
  'compliance.current_driver_vehicle_insurance', "operating.status !== 'NOT_ELIGIBLE'",
  'capabilitiesExplicitAndCurrent: capabilitiesExplicit', 'externalFleetOrganisationActive: row.external_tenancy_active',
  'externalTenancyBypassAllowed: false', 'replacementRequiresFreshValidation: true'
]) if (!service.includes(guard)) errors.push(`Missing Fleet projection guard: ${guard}`);
if (/\b(?:INSERT|UPDATE|DELETE)\b/i.test(service)) errors.push('Read-only Fleet service contains a persistence mutation');
if (/fetch\(|axios|autotrader|leasing\.com|provider/i.test(service)) errors.push('Fleet service contains an unapproved supplier/provider integration');

const routes = readFileSync(join(root, 'services/api/src/modules/fleet-operations/routes.ts'), 'utf8');
for (const path of ['/v1/fleet/marketplace', '/v1/fleet/marketplace/:offerId', '/v1/driver/fleet-agreements', '/v1/driver/vehicle-assignment-validation']) {
  if (!routes.includes(path)) errors.push(`Fleet API route missing: ${path}`);
}
if (/app\.(post|put|patch|delete)\(/i.test(routes)) errors.push('Phase 0.9 exposes an unauthorised Fleet mutation route');

const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
if ((dispatch.match(/driver\.current_driver_vehicle_authorisation/g) ?? []).length < 2) {
  errors.push('Dispatch does not enforce actual-pair insured DriverVehicleAuthorisation at availability and candidate filtering');
}
const driverOperations = readFileSync(join(root, 'services/api/src/modules/driver-operations/driver-operations-service.ts'), 'utf8');
if (!driverOperations.includes('driver.current_driver_vehicle_authorisation')) errors.push('Operating eligibility bypasses pair-insurance authorisation');

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const truth of ['DAZAT does not promise a generic discount', 'Deposits are not platform revenue', 'replacement assignment re-runs']) {
  if (!driver.includes(truth)) errors.push(`Driver Fleet truth label missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of ['cannot invent a generic discount', 'Deposits remain separate from revenue', 'never bypasses DAZAT']) {
  if (!controlRoom.includes(truth)) errors.push(`Control Room Fleet boundary missing: ${truth}`);
}

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/fleet/marketplace:', '/fleet/marketplace/{offerId}:', '/driver/fleet-agreements:', '/driver/vehicle-assignment-validation:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.9 path missing: ${path}`);
}
for (const statement of ['No purchase, reservation or generic discount claim is created', 'Deposit values remain separate from platform revenue', 'External FleetOrganisation tenancy never bypasses DAZAT authority']) {
  if (!api.includes(statement)) errors.push(`OpenAPI Fleet truth statement missing: ${statement}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.9 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.9 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus supplier, terms, capability, insurance, deposit and assignment boundaries.`);
