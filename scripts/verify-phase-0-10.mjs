import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0010_maintenance_defect_reliability_foundation.sql',
  'packages/domain/src/maintenance-reliability.ts',
  'packages/contracts/src/maintenance-reliability.ts',
  'services/api/src/modules/maintenance-reliability/maintenance-reliability-service.ts',
  'services/api/src/modules/maintenance-reliability/routes.ts',
  'apps/driver/src/maintenance-reliability-api.ts',
  'docs/architecture/ADR-0010-maintenance-defect-reliability-truth.md',
  'docs/engineering/phase-0-10-checklist.md',
  'docs/traceability/phase-0-10-requirements.md',
  'tests/domain/maintenance-reliability-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.10 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const additionsPath = join(root, 'SOURCE_MANIFEST_ADDITIONS.txt');
const additions = existsSync(additionsPath) ? readFileSync(additionsPath, 'utf8').trim().split('\n').filter(Boolean) : [];
const declared = [...manifest, ...additions].filter(Boolean).sort();
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split('\n').sort().map((path) => `./${path}`);
if (declared.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt plus SOURCE_MANIFEST_ADDITIONS.txt does not exactly match the source tree');

const sql = existsSync(join(root, required[0])) ? readFileSync(join(root, required[0]), 'utf8') : '';
for (const object of [
  'vehicle_fleet.vehicle_maintenance_plan', 'vehicle_fleet.vehicle_maintenance_plan_version',
  'vehicle_fleet.current_vehicle_maintenance_plan', 'vehicle_fleet.maintenance_requirement',
  'vehicle_fleet.maintenance_requirement_evaluation', 'vehicle_fleet.current_maintenance_requirement',
  'vehicle_fleet.vehicle_pre_shift_check', 'vehicle_fleet.vehicle_defect',
  'vehicle_fleet.vehicle_defect_transition', 'vehicle_fleet.vehicle_defect_assessment',
  'vehicle_fleet.vehicle_restriction', 'vehicle_fleet.vehicle_restriction_transition',
  'vehicle_fleet.current_vehicle_restriction', 'vehicle_fleet.maintenance_case',
  'vehicle_fleet.maintenance_case_defect', 'vehicle_fleet.maintenance_provider',
  'vehicle_fleet.vehicle_recall_notice', 'vehicle_fleet.vehicle_recall_resolution',
  'vehicle_fleet.warranty_evaluation', 'vehicle_fleet.repair_estimate',
  'vehicle_fleet.repair_authorisation', 'vehicle_fleet.repair_invoice',
  'vehicle_fleet.maintenance_completion_record', 'vehicle_fleet.post_maintenance_inspection',
  'vehicle_fleet.return_to_service_decision', 'vehicle_fleet.maintenance_provider_quality_observation',
  'vehicle_fleet.repeat_defect_signal', 'rescue.breakdown_event',
  'vehicle_fleet.vehicle_replacement_request', 'vehicle_fleet.vehicle_reliability_observation',
  'driver.maintenance_compliance_assessment', 'driver.driver_perk_offer_version',
  'driver.current_verified_perk_offer', 'vehicle_fleet.whole_life_cost_evidence',
  'vehicle_fleet.current_vehicle_maintenance_gate', 'vehicle_fleet.maintenance_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.10 persistence object: ${object}`);

for (const guarantee of [
  "'MANUFACTURER','LEGAL_LICENSING','DAZAT_POLICY','FLEET_AGREEMENT','DEFECT','RECALL','BREAKDOWN_FOLLOW_UP'",
  "'ROUTINE','DUE_SOON','OVERDUE','SAFETY_REVIEW','DO_NOT_USE'",
  'driver_diagnosis_required boolean NOT NULL DEFAULT false CHECK (driver_diagnosis_required = false)',
  'creates_driver_fault_finding boolean NOT NULL DEFAULT false CHECK (creates_driver_fault_finding = false)',
  'Core roadworthiness items',
  'VehicleDefect current state requires matching append-only transition history',
  'VehicleRestriction current state requires matching append-only transition history',
  'MaintenanceCase current state requires matching append-only transition history',
  'Repair authorisation requires a matching estimate and prior warranty evaluation',
  'ReturnToService approval requires completed work, independent passed inspection, cleared hard blockers and matching current AVAILABLE transition',
  "vehicle.fleet_state = 'AVAILABLE'", 'vehicle.fleet_state_version = transition.version',
  'Repeat-defect signal requires at least two preserved VehicleDefect records',
  'driver_neglect_finding boolean NOT NULL DEFAULT false CHECK (driver_neglect_finding = false)',
  'reporting_penalty_applied boolean NOT NULL DEFAULT false CHECK (reporting_penalty_applied = false)',
  'derived_from_breakdown_alone boolean NOT NULL DEFAULT false CHECK (derived_from_breakdown_alone = false)',
  'verified_before_marketing boolean NOT NULL DEFAULT true CHECK (verified_before_marketing = true)',
  'offer.provider_verified_at <= now()',
  'brochure_price_only boolean NOT NULL DEFAULT false CHECK (brochure_price_only = false)',
  'unresolved_safety_critical_recall',
  'maintenance.operating_permitted = true', 'vehicle_maintenance_plan_version_id', 'vehicle_restriction_ids'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.10 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/maintenance-reliability.ts'), 'utf8');
for (const guard of [
  'evaluatePreShiftCheck', 'Core roadworthiness items cannot be marked not applicable',
  'driverDiagnosisRequired: false', 'createsDriverFaultFinding: false',
  'evaluateMaintenanceOperatingGate', 'ACTIVE_MAINTENANCE_PLAN_REQUIRED',
  'CURRENT_MAINTENANCE_REQUIREMENTS_REQUIRED', 'VEHICLE_SAFETY_REVIEW_REQUIRED',
  'VEHICLE_DO_NOT_USE', 'VEHICLE_SERVICE_RESTRICTED', 'UNRESOLVED_SAFETY_CRITICAL_RECALL', 'overdueAutomaticallyProvesNeglect: false',
  'canTransitionVehicleDefect', 'repairMayBeAuthorised', 'returnToServiceMayBeApproved',
  'verifiedPerkMayBePublished', 'wholeLifeCostEvidenceIsComplete',
  'BREAKDOWN_ALONE_PROVES_DRIVER_NEGLECT = false', 'VEHICLE_RELIABILITY_IS_DRIVER_COMPLIANCE = false',
  'REPLACEMENT_WORKFLOW_MAY_PENALISE_DEFECT_REPORTING = false',
  'PASSENGER_CONTINUITY_IS_REPLACEMENT_ASSIGNMENT = false', 'UNVERIFIED_PERK_MAY_BE_MARKETED = false'
]) if (!domain.includes(guard)) errors.push(`Missing maintenance/reliability domain guard: ${guard}`);

const service = readFileSync(join(root, 'services/api/src/modules/maintenance-reliability/maintenance-reliability-service.ts'), 'utf8');
for (const guard of [
  'driver.current_driver_vehicle_authorisation', 'vehicle_fleet.current_vehicle_maintenance_gate',
  'evaluatePreShiftCheck', "'DRIVER_PRE_SHIFT'", "'ALL_SERVICES'", "'QUARANTINED'",
  'moveDriverOfflineIfSafe', 'openPassengerContinuityIfActive', 'driverFaultFinding: false',
  'breakdownAloneProvesDriverNeglect: false', 'reliabilityIsDriverCompliance: false',
  'unresolvedSafetyCriticalRecall',
  'driver.current_verified_perk_offer', 'verifiedBeforeMarketing: true', 'request_fingerprint'
]) if (!service.includes(guard)) errors.push(`Missing maintenance service guard: ${guard}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Maintenance service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/maintenance-reliability/routes.ts'), 'utf8');
for (const path of ['/v1/driver/vehicles/:vehicleId/maintenance', '/v1/driver/vehicles/:vehicleId/pre-shift-checks', '/v1/driver/perks']) {
  if (!routes.includes(path)) errors.push(`Maintenance API route missing: ${path}`);
}
if (!routes.includes("requireDriver(request, reply, pool, 'SAFETY')")) errors.push('Pre-shift mutation lacks the Driver SAFETY capability gate');

const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
for (const guard of ['maintenancePermitsServices', 'current_vehicle_maintenance_gate', 'vehicle_maintenance_plan_version_id', 'vehicle_restriction_ids']) {
  if (!dispatch.includes(guard)) errors.push(`Dispatch maintenance hard filter missing: ${guard}`);
}
const journey = readFileSync(join(root, 'services/api/src/modules/journey/journey-service.ts'), 'utf8');
for (const guard of ['current_vehicle_maintenance_gate', 'maintenance.operating_permitted', 'restricted_service_codes']) {
  if (!journey.includes(guard)) errors.push(`Journey start maintenance hard filter missing: ${guard}`);
}
const driverOperations = readFileSync(join(root, 'services/api/src/modules/driver-operations/driver-operations-service.ts'), 'utf8');
for (const guard of ['current_vehicle_maintenance_gate', 'maintenanceOperatingPermitted', 'maintenanceRestrictedServiceCodes']) {
  if (!driverOperations.includes(guard)) errors.push(`Driver eligibility maintenance gate missing: ${guard}`);
}
const fleet = readFileSync(join(root, 'services/api/src/modules/fleet-operations/fleet-operations-service.ts'), 'utf8');
for (const guard of ['current_vehicle_maintenance_gate', 'maintenancePlanCurrent', 'maintenanceOperatingPermitted']) {
  if (!fleet.includes(guard)) errors.push(`Fleet assignment maintenance gate missing: ${guard}`);
}

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const truth of ['something does not feel right', 'without diagnosing a fault', 'no Driver fault finding', 'Verified current perks']) {
  if (!driver.includes(truth)) errors.push(`Driver maintenance truth label missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of ['Maintenance safety overrides commercial pressure', 'not a Driver fault finding', 'Breakdown evidence does not prove neglect']) {
  if (!controlRoom.includes(truth)) errors.push(`Control Room maintenance boundary missing: ${truth}`);
}

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/driver/vehicles/{vehicleId}/maintenance:', '/driver/vehicles/{vehicleId}/pre-shift-checks:', '/driver/perks:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.10 path missing: ${path}`);
}
for (const statement of ['something does not feel right without diagnosis', 'Breakdown alone never proves Driver neglect', 'Unverified fuel, charging, tyres']) {
  if (!api.includes(statement)) errors.push(`OpenAPI maintenance truth statement missing: ${statement}`);
}
if (!/version: 0\.0\.(?:1[0-9]|[2-9][0-9])\b/.test(api)) errors.push('OpenAPI is older than Phase 0.10');

for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const patch = Number(String(parsed.version).split('.')[2]);
  if (!Number.isInteger(patch) || patch < 10) errors.push(`${rel} is older than Phase 0.10`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.10 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.10 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus maintenance, defect, repair, reliability, replacement, perks and cross-workflow safety boundaries.`);
