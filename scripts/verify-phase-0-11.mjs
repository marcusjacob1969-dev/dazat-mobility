import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0011_driver_fair_treatment_foundation.sql',
  'packages/domain/src/driver-fair-treatment.ts',
  'packages/contracts/src/driver-fair-treatment.ts',
  'services/api/src/modules/driver-fair-treatment/driver-fair-treatment-service.ts',
  'services/api/src/modules/driver-fair-treatment/routes.ts',
  'apps/driver/src/driver-fair-treatment-api.ts',
  'docs/architecture/ADR-0011-driver-fair-treatment-truth.md',
  'docs/engineering/phase-0-11-checklist.md',
  'docs/traceability/phase-0-11-requirements.md',
  'tests/domain/driver-fair-treatment-source.test.mjs'
];

const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.11 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = existsSync(join(root, required[0])) ? readFileSync(join(root, required[0]), 'utf8') : '';
for (const object of [
  'driver.driver_restriction_review', 'driver.driver_rating_feedback',
  'driver.driver_complaint', 'driver.driver_complaint_transition',
  'driver.driver_complaint_evidence_item', 'driver.driver_complaint_driver_response',
  'driver.driver_complaint_assessment', 'driver.driver_complaint_finding',
  'driver.driver_complaint_action', 'dispatch.driver_offer_outcome_attribution',
  'driver.driver_reliability_review', 'safety.rider_conduct_case',
  'safety.rider_conduct_case_transition', 'journey.safety_termination',
  'finance.driver_incentive_programme_version', 'finance.driver_incentive_qualification',
  'finance.current_driver_incentive_programme', 'driver.driver_offboarding_case',
  'driver.driver_offboarding_transition', 'driver.driver_offboarding_decision',
  'driver.driver_decision_appeal', 'driver.driver_decision_appeal_transition',
  'driver.driver_decision_appeal_evidence', 'driver.driver_decision_appeal_resolution',
  'driver.current_driver_fair_treatment_projection'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.11 persistence object: ${object}`);

for (const guarantee of [
  'guilt_finding boolean NOT NULL DEFAULT false CHECK (guilt_finding = false)',
  'narrowest_safe_scope boolean NOT NULL DEFAULT true CHECK (narrowest_safe_scope = true)',
  'is_conduct_finding boolean NOT NULL DEFAULT false CHECK (is_conduct_finding = false)',
  'automatically_changes_dispatch_priority boolean NOT NULL DEFAULT false',
  'DriverComplaint allegation identity and provenance are immutable',
  'DriverComplaint current stage requires matching append-only transition history',
  'DriverComplaint transition history must form an unbroken stage chain',
  'DriverComplaint finding stage requires an evidence-backed assessment',
  'Driver cannot make the authorised finding on their own complaint',
  "'ACCEPTED','DECLINED','TIMED_OUT','TECHNICAL_FAILURE','WITHDRAWN'",
  'acceptance_rate_penalty_applied boolean NOT NULL DEFAULT false',
  'dispatch_priority_penalty_applied boolean NOT NULL DEFAULT false',
  'HISTORICAL_TERMINAL_OFFER_BACKFILL',
  'automatically_creates_misconduct boolean NOT NULL DEFAULT false',
  'safe_termination_protected boolean NOT NULL DEFAULT true',
  'rating_protection_required boolean NOT NULL DEFAULT true',
  'driver_fault_finding_created boolean NOT NULL DEFAULT false',
  'passenger_continuity_opened boolean NOT NULL DEFAULT true',
  'acceptance_coercion_allowed boolean NOT NULL DEFAULT false',
  'fatigue_pressure_allowed boolean NOT NULL DEFAULT false',
  'secret_dispatch_priority_boost_allowed boolean NOT NULL DEFAULT false',
  'High-impact appeal outcome requires independent reviewed resolution',
  'DriverDecisionAppeal transition history must form an unbroken state chain',
  'Driver cannot independently review their own appeal',
  'Original decision maker cannot perform the independent appeal review',
  'earnings_preserved boolean NOT NULL DEFAULT true',
  'disputes_preserved boolean NOT NULL DEFAULT true',
  'vehicle_return_obligations_preserved boolean NOT NULL DEFAULT true',
  'termination.rating_protected = true', 'opaque_driver_score_used', 'ordinary_decline_penalty_applied'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.11 SQL guarantee: ${guarantee}`);

const domain = readFileSync(join(root, 'packages/domain/src/driver-fair-treatment.ts'), 'utf8');
for (const guard of [
  'DRIVER_PERFORMANCE_DIMENSIONS', 'evaluateRatingFeedback', 'conductFindingCreated: false',
  'canTransitionDriverComplaint', 'complaintFindingMayBeRecorded', 'ratingOnly',
  'DRIVER_OFFER_OUTCOMES', 'evaluateOfferOutcomeFairness',
  'acceptanceRatePenaltyApplied: false', 'dispatchPriorityPenaltyApplied: false',
  'evaluateReliabilityAttribution', 'precautionaryRestrictionMayBeApplied',
  'highImpactAppealMayBeResolved', 'RIDER_CONDUCT_CATEGORIES',
  'unsafeJourneyTerminationMayProceed', 'driverMayEnterBreakAfterUnsafeTermination', 'driverIncentiveMayBePublished',
  'offboardingHistoryIsPreserved', 'OPAQUE_DRIVER_SCORE_USED = false',
  'ORDINARY_OFFER_DECLINE_IS_MISCONDUCT = false', 'TEMPORARY_RESTRICTION_IS_GUILT = false',
  'SAFE_JOURNEY_TERMINATION_MAY_HARM_RATING = false'
]) if (!domain.includes(guard)) errors.push(`Missing Driver fair-treatment domain guard: ${guard}`);

const service = readFileSync(join(root, 'services/api/src/modules/driver-fair-treatment/driver-fair-treatment-service.ts'), 'utf8');
for (const guard of [
  'current_driver_fair_treatment_projection', 'assertAppealSubjectOwnedByDriver',
  "'driver.appeal-submitted'", "'RIDER_CONDUCT_REPORT'", 'safety.rider_conduct_case',
  'unsafeJourneyTerminationMayProceed', 'driverMayEnterBreakAfterUnsafeTermination', 'journey.safety_termination', "status = 'CANCELLED'",
  "status = 'INTERRUPTED'", "'ACTIVE_INCIDENT'", "status = 'BREAK'",
  'journey.continuity_case', 'ratingProtected: true', 'driverFaultFindingCreated: false',
  'current_driver_incentive_programme', 'secretDispatchPriorityBoostAllowed: false'
]) if (!service.includes(guard)) errors.push(`Missing fair-treatment service guard: ${guard}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Fair-treatment service contains an unapproved external provider call');

const routes = readFileSync(join(root, 'services/api/src/modules/driver-fair-treatment/routes.ts'), 'utf8');
for (const path of [
  '/v1/driver/fair-treatment', '/v1/driver/rider-conduct-cases',
  '/v1/driver/journeys/:journeyId/unsafe-termination', '/v1/driver/appeals',
  '/v1/driver/incentives'
]) if (!routes.includes(path)) errors.push(`Driver fair-treatment API route missing: ${path}`);
if ((routes.match(/requireDriver\(request, reply, pool, 'SAFETY'\)/g) ?? []).length < 2) {
  errors.push('Rider-conduct and unsafe-termination mutations lack Driver SAFETY capability gates');
}

const dispatch = readFileSync(join(root, 'services/api/src/modules/dispatch/dispatch-service.ts'), 'utf8');
for (const guard of [
  'driver_offer_outcome_attribution', "'TIMED_OUT'", "'DECLINED'", "'ACCEPTED'",
  "'DRIVER_BECAME_INELIGIBLE'", "'ASSIGNED_ELSEWHERE'",
  'acceptance_rate_penalty_applied, dispatch_priority_penalty_applied'
]) if (!dispatch.includes(guard)) errors.push(`Dispatch fair-offer attribution missing: ${guard}`);

const driver = readFileSync(join(root, 'apps/driver/App.tsx'), 'utf8');
for (const truth of [
  'no hidden score', 'Opaque Driver Score: NOT USED', 'allegation is not a finding',
  'End unsafe Journey safely', 'rating protection required', 'Submit for independent review',
  'unsafe fatigue pressure and secret priority boosts'
]) if (!driver.includes(truth)) errors.push(`Driver fair-treatment truth label missing: ${truth}`);

const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Fair treatment has no opaque Driver Score', 'A rating is feedback, not a finding',
  'Temporary restrictions use the narrowest safe scope', 'Safe Journey termination opens passenger continuity'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room fair-treatment boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of [
  '/driver/fair-treatment:', '/driver/rider-conduct-cases:',
  '/driver/journeys/{journeyId}/unsafe-termination:', '/driver/appeals:', '/driver/incentives:'
]) if (!api.includes(path)) errors.push(`OpenAPI Phase 0.11 path missing: ${path}`);
for (const statement of [
  'without an opaque Driver Score', 'Ratings are feedback, not findings',
  'Ordinary declines never create a hidden priority penalty', 'protects the Driver rating',
  'unsafe fatigue pressure or a secret Dispatch-priority boost'
]) if (!api.includes(statement)) errors.push(`OpenAPI fair-treatment truth statement missing: ${statement}`);
if (!/version: 0\.0\.(?:1[1-9]|[2-9][0-9])\b/.test(api)) errors.push('OpenAPI is older than Phase 0.11');

for (const rel of ['package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json', 'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const patch = Number(String(parsed.version).split('.')[2]);
  if (!Number.isInteger(patch) || patch < 11) errors.push(`${rel} is older than Phase 0.11`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.11 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('DAZAT Engineering Phase 0.11 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus rating, complaint, offer, restriction, conduct, appeal, incentive, offboarding and cross-workflow Safety boundaries.`);
