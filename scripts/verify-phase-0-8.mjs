import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0008_driver_onboarding_competency_permissions_foundation.sql',
  'packages/domain/src/driver-operations.ts',
  'packages/contracts/src/driver-operations.ts',
  'services/api/src/modules/driver-operations/driver-operations-service.ts',
  'services/api/src/modules/driver-operations/routes.ts',
  'apps/driver/src/driver-operations-api.ts',
  'docs/architecture/ADR-0008-driver-onboarding-operating-permission-truth.md',
  'docs/engineering/phase-0-8-checklist.md',
  'docs/traceability/phase-0-8-requirements.md',
  'tests/domain/driver-operations-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.8 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== tracked.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = existsSync(join(root, required[0])) ? readFileSync(join(root, required[0]), 'utf8') : '';
for (const object of [
  'driver.driver_application', 'driver.driver_application_transition', 'driver.driver_application_decision',
  'compliance.requirement_definition', 'compliance.driver_requirement_status', 'compliance.driver_document',
  'compliance.document_verification_review', 'driver.training_module', 'driver.training_record',
  'driver.driver_permission', 'driver.driver_restriction', 'driver.operating_eligibility_snapshot',
  'driver.current_permission_projection',
  'driver.command_deduplication', 'driver.outbox_message', 'driver.current_application_projection'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.8 persistence object: ${object}`);
for (const guarantee of [
  'DriverApplication current state requires matching append-only transition history',
  'DriverApplication approval/decline requires an authorised decision record',
  'Authorised DriverApplication decision must match committed terminal application truth',
  'DriverApplication approval requires all recorded requirements satisfied and current',
  'DriverApplication and DriverProfile onboarding projection must agree',
  'extraction_authoritative boolean NOT NULL DEFAULT false CHECK (extraction_authoritative = false)',
  'DriverDocument requires an authorised verification review',
  "risk_tier <> 'HIGH_RISK' OR assessment_required = true",
  'Assessed training cannot pass without evidence meeting the versioned pass mark',
  'A Driver cannot assess their own competency',
  'Active high-risk permission requires current assessed competency evidence',
  'Active DriverPermission validity windows cannot overlap',
  "scope IN ('ALL_SERVICES','SCHOOL_ONLY','WAV_ONLY','NEW_JOURNEYS','PAYOUT_ONLY','SPECIFIC_VEHICLE')",
  'dispatch.candidate_snapshot', 'driver_permission_ids uuid[]', 'active_restriction_ids uuid[]',
  'operating_eligibility_snapshot_immutable'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.8 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/driver-operations.ts'), 'utf8');
for (const guard of [
  'canTransitionDriverApplication', 'documentSatisfiesCompliance', 'trainingGrantsCompetency',
  'evaluateDriverOperatingEligibility', 'SELECTED_VEHICLE_RESTRICTION_ACTIVE',
  'ALL_CURRENT_SERVICE_PERMISSIONS_RESTRICTED', 'availabilityEvaluatedSeparately: true',
  'OCR_IS_AUTHORITATIVE_COMPLIANCE_VERIFICATION = false', 'OPERATING_RESTRICTION_ACTIVE'
]) if (!domain.includes(guard)) errors.push(`Missing Driver operations domain guard: ${guard}`);
const dispatchDomain = readFileSync(join(root, 'packages/domain/src/dispatch.ts'), 'utf8');
for (const guard of ['SERVICE_PERMISSION_MISMATCH', 'OPERATING_RESTRICTION_ACTIVE']) {
  if (!dispatchDomain.includes(guard)) errors.push(`Missing Dispatch permission hard filter: ${guard}`);
}

const service = readFileSync(join(root, 'services/api/src/modules/driver-operations/driver-operations-service.ts'), 'utf8');
for (const guard of [
  'FOR UPDATE', "verification.status = 'VERIFIED'", "row?.status === 'STARTED'", "status = 'CONTACT_VERIFIED'",
  'AUTHORITATIVE_VERIFIED_CONTACT_AUTHENTICATOR', 'driver.current_permission_projection', 'externalVerificationConfigured: false',
  'ocrMayApproveCompliance: false', 'AUTHORITATIVE_CURRENT_PROJECTION'
]) if (!service.includes(guard)) errors.push(`Missing Driver operations service guard: ${guard}`);
if (/SET\s+status\s*=\s*'APPROVED'/i.test(service)) errors.push('Driver self-service contains a direct APPROVED mutation');
if (/INSERT INTO\s+(?:compliance\.(?:driver_document|document_verification_review)|driver\.(?:training_record|driver_permission|driver_restriction|driver_application_decision))/i.test(service)) {
  errors.push('Driver self-service can mint document verification, competency, permission, restriction or approval truth');
}
if (/fetch\(|axios|onfido|veriff|persona|sumsub/i.test(service)) errors.push('Driver service contains an unapproved external identity-verification dependency');

const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
for (const guard of [
  'requiredPermissionServiceCodes', 'servicePermissionMatch: row.service_permission_match',
  'operatingRestrictionActive: row.operating_restriction_active', 'driver_permission_ids',
  'active_restriction_ids'
]) if (!dispatch.includes(guard)) errors.push(`Dispatch/Phase 0.8 integration guard missing: ${guard}`);

const routes = readFileSync(join(root, 'services/api/src/modules/driver-operations/routes.ts'), 'utf8');
for (const path of ['/v1/driver/applications', '/v1/driver/application', '/v1/driver/operating-eligibility']) {
  if (!routes.includes(path)) errors.push(`Driver operations API route missing: ${path}`);
}
if (!routes.includes("'MANAGE_DRIVER_APPLICATION'")) errors.push('Application mutation lacks its dedicated account capability');
if (/approve|decline|document|training|permission|restriction/i.test(routes)) errors.push('Unauthorised Phase 0.8 authority mutation route exposed');

const identity = readFileSync(join(root, 'packages/domain/src/identity.ts'), 'utf8');
if (!identity.includes("'MANAGE_DRIVER_APPLICATION'")) errors.push('Driver application capability is absent');

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const truth of ['Application approval never grants operating eligibility by itself', 'OCR CANNOT APPROVE COMPLIANCE', 'Availability is evaluated separately']) {
  if (!driver.includes(truth)) errors.push(`Driver operating truth label missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of ['OCR is provenance, never authoritative compliance verification', 'cannot directly set APPROVED', 'precautionary restrictions are not findings of guilt']) {
  if (!controlRoom.includes(truth)) errors.push(`Control Room Driver authority boundary missing: ${truth}`);
}

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/driver/applications:', '/driver/application:', '/driver/operating-eligibility:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.8 path missing: ${path}`);
}
for (const statement of ['OCR/extraction is never authoritative compliance verification', 'Availability is evaluated separately', 'CONTACT_VERIFICATION_REQUIRED']) {
  if (!api.includes(statement)) errors.push(`OpenAPI Driver truth statement missing: ${statement}`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.8 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.8 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus approval, evidence, competency, permission, restriction and availability boundaries.`);
