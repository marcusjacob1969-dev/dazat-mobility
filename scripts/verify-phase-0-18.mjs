import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = [
  'database/migrations/0018_institutional_passenger_recurring_bulk_foundation.sql',
  'packages/domain/src/institutional-transport.ts',
  'packages/contracts/src/institutional-transport.ts',
  'services/api/src/modules/institutional-transport/institutional-transport-service.ts',
  'services/api/src/modules/institutional-transport/routes.ts',
  'apps/organisation-portal/src/organisation-api.ts',
  'apps/organisation-portal/src/App.tsx',
  'docs/architecture/ADR-0018-institutional-passenger-recurring-transport.md',
  'docs/engineering/phase-0-18-checklist.md',
  'docs/traceability/phase-0-18-requirements.md',
  'tests/domain/institutional-transport-source.test.mjs'
];
const errors = [];
for (const rel of required) if (!existsSync(join(root, rel))) errors.push(`Missing Phase 0.18 file: ${rel}`);

const manifest = readFileSync(join(root, 'SOURCE_MANIFEST.txt'), 'utf8').trim().split('\n');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').sort().map((path) => `./${path}`);
if (manifest.join('\n') !== source.join('\n')) errors.push('SOURCE_MANIFEST.txt does not exactly match the source tree');

const sql = readFileSync(join(root, required[0]), 'utf8');
for (const object of [
  'organisation.managed_passenger_profile', 'organisation.managed_passenger_profile_status_event',
  'organisation.organisation_passenger_membership', 'organisation.passenger_membership_status_event',
  'organisation.passenger_authorised_contact_version', 'organisation.service_eligibility_profile_version',
  'organisation.funding_authorisation_version', 'organisation.booking_template_version',
  'organisation.booking_series', 'organisation.booking_series_amendment',
  'organisation.booking_occurrence', 'organisation.school_calendar_version',
  'organisation.school_calendar_date', 'organisation.scheduled_pickup_window',
  'organisation.passenger_readiness_event', 'organisation.institutional_capacity_reservation',
  'organisation.driver_schedule_conflict_assessment', 'organisation.bulk_passenger_import_batch',
  'organisation.bulk_passenger_import_row', 'organisation.bulk_booking_batch',
  'organisation.bulk_booking_row', 'organisation.bulk_batch_status_event',
  'organisation.passenger_substitution_decision', 'organisation.institutional_cancellation_decision',
  'organisation.organisation_transport_exception', 'organisation.transport_exception_status_event',
  'organisation.institutional_booking_provenance', 'organisation.institutional_acceptance_case_version',
  'organisation.institutional_command_deduplication', 'organisation.institutional_transport_event',
  'organisation.institutional_transport_outbox_message'
]) if (!sql.includes(object)) errors.push(`Missing Phase 0.18 persistence object: ${object}`);

for (const guarantee of [
  'organisation_owns_passenger_identity boolean NOT NULL DEFAULT false CHECK (organisation_owns_passenger_identity = false)',
  'diagnosis_stored_by_default boolean NOT NULL DEFAULT false CHECK (diagnosis_stored_by_default = false)',
  'other_organisation_relationship_disclosed boolean NOT NULL DEFAULT false CHECK (other_organisation_relationship_disclosed = false)',
  'financial_access boolean NOT NULL DEFAULT false CHECK (financial_access = false)',
  'diagnosis_data_included boolean NOT NULL DEFAULT false CHECK (diagnosis_data_included = false)',
  'accessibility_downgrade_allowed boolean NOT NULL DEFAULT false CHECK (accessibility_downgrade_allowed = false)',
  'acts_as_stored_money boolean NOT NULL DEFAULT false CHECK (acts_as_stored_money = false)',
  'decides_statutory_eligibility boolean NOT NULL DEFAULT false CHECK (decides_statutory_eligibility = false)',
  'passenger_personal_liability_fallback boolean NOT NULL DEFAULT false CHECK (passenger_personal_liability_fallback = false)',
  'reserves_driver boolean NOT NULL DEFAULT false CHECK (reserves_driver = false)',
  'creates_finance_liability boolean NOT NULL DEFAULT false CHECK (creates_finance_liability = false)',
  'is_canonical_booking boolean NOT NULL DEFAULT false CHECK (is_canonical_booking = false)',
  'completed_booking_changed boolean NOT NULL DEFAULT false CHECK (completed_booking_changed = false)',
  'active_journey_changed_directly boolean NOT NULL DEFAULT false CHECK (active_journey_changed_directly = false)',
  'guaranteed_instant_collection boolean NOT NULL DEFAULT false CHECK (guaranteed_instant_collection = false)',
  'automatically_recorded_no_show boolean NOT NULL DEFAULT false CHECK (automatically_recorded_no_show = false)',
  'cross_tenant_relationship_disclosed boolean NOT NULL DEFAULT false CHECK (cross_tenant_relationship_disclosed = false)',
  'creates_journey_or_payment_directly boolean NOT NULL DEFAULT false CHECK (creates_journey_or_payment_directly = false)',
  'active_journey_cancelled_by_portal boolean NOT NULL DEFAULT false CHECK (active_journey_cancelled_by_portal = false)',
  'portal_calculated_charge boolean NOT NULL DEFAULT false CHECK (portal_calculated_charge = false)',
  'journey_or_payment_written_directly boolean NOT NULL DEFAULT false CHECK (journey_or_payment_written_directly = false)',
  'external_execution_enabled boolean NOT NULL DEFAULT false CHECK (external_execution_enabled = false)'
]) if (!sql.includes(guarantee)) errors.push(`Missing Phase 0.18 SQL guarantee: ${guarantee}`);

for (const boundary of [
  'managed_passenger_profile_update_guard', 'passenger_membership_update_guard',
  'passenger_authorised_contact_update_guard', 'service_eligibility_profile_update_guard',
  'funding_authorisation_update_guard', 'booking_template_update_guard',
  'booking_series_immutable', 'booking_series_amendment_immutable', 'booking_occurrence_immutable',
  'school_calendar_update_guard', 'school_calendar_date_immutable', 'scheduled_pickup_window_immutable',
  'passenger_readiness_event_immutable', 'institutional_capacity_reservation_immutable',
  'driver_schedule_conflict_assessment_immutable', 'bulk_passenger_import_batch_update_guard',
  'bulk_booking_batch_update_guard', 'bulk_passenger_import_row_immutable', 'bulk_booking_row_immutable',
  'passenger_substitution_decision_immutable', 'institutional_cancellation_decision_immutable',
  'transport_exception_update_guard', 'institutional_booking_provenance_immutable',
  'institutional_acceptance_case_update_guard', 'institutional_command_deduplication_immutable',
  'institutional_transport_event_immutable', 'institutional_transport_outbox_message_immutable',
  'UNIQUE (organisation_id, command_type, idempotency_key)',
  'canonical_booking_id uuid NOT NULL UNIQUE REFERENCES booking.booking(id)',
  "event.batch_kind = CASE WHEN TG_TABLE_NAME = 'bulk_passenger_import_batch' THEN 'PASSENGER_IMPORT' ELSE 'BOOKING' END",
  'Invalid managed passenger profile transition', 'Invalid institutional passenger membership transition',
  'Invalid institutional bulk batch transition', 'Invalid institutional transport exception transition'
]) if (!sql.includes(boundary)) errors.push(`Missing Phase 0.18 SQL boundary: ${boundary}`);
if ((sql.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length !== 31) errors.push('Phase 0.18 migration must define exactly 31 persistence tables');
if ((sql.match(/\$\$/g) ?? []).length % 2 !== 0) errors.push('Phase 0.18 migration has unbalanced dollar quotes');
const triggerCreates = (sql.match(/CREATE TRIGGER /g) ?? []).length + (sql.match(/CREATE CONSTRAINT TRIGGER /g) ?? []).length;
if (triggerCreates !== (sql.match(/DROP TRIGGER IF EXISTS /g) ?? []).length) errors.push('Phase 0.18 migration trigger declarations are unbalanced');

const domain = readFileSync(join(root, 'packages/domain/src/institutional-transport.ts'), 'utf8');
for (const boundary of [
  'ORGANISATION_PASSENGER_MEMBERSHIP_STATES', 'INSTITUTIONAL_SERVICE_TYPES',
  'BOOKING_SERIES_CHANGE_SCOPES', 'BULK_PASSENGER_IMPORT_STATES',
  'INSTITUTIONAL_CANCELLATION_REASONS', 'ORGANISATION_TRANSPORT_EXCEPTION_TYPES',
  'INSTITUTIONAL_TRANSPORT_API_PATHS', 'INSTITUTIONAL_TRANSPORT_COMMANDS',
  'INSTITUTIONAL_TRANSPORT_EVENTS', 'INSTITUTIONAL_TRANSPORT_P0_REQUIREMENTS',
  'INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS', 'evaluateManagedPassengerRelationship',
  'CROSS_TENANT_PASSENGER_RELATIONSHIP_DISCLOSURE', 'TRANSPORT_DATA_MINIMISATION_REQUIRED',
  'evaluateInstitutionalBookingAuthority', 'OPEN_FUNDING_OR_APPROVAL_EXCEPTION',
  'PERSONAL_PASSENGER_LIABILITY_FALLBACK_PROHIBITED', 'evaluateInstitutionalServiceEligibility',
  'NO_ELIGIBLE_SERVICE', 'NO_ELIGIBLE_DRIVER', 'evaluateBookingOccurrenceGeneration',
  'ONE_CANONICAL_BOOKING_PER_OCCURRENCE_REQUIRED', 'TEMPLATE_CANNOT_RESERVE_DRIVER',
  'evaluateBookingSeriesAmendment', 'ACTIVE_JOURNEY_REQUIRES_CANONICAL_AMENDMENT',
  'evaluateSchoolInstitutionalSchedule', 'FAMILIARITY_CANNOT_OVERRIDE_HARD_ELIGIBILITY',
  'evaluateScheduledInstitutionalCapacity', 'CAPABILITY_AWARE_CAPACITY_REQUIRED',
  'evaluatePassengerReadiness', 'passengerNoShowRecorded: false',
  'evaluateInstitutionalBulkCommit', 'CROSS_TENANT_DUPLICATE_DISCLOSURE_PROHIBITED',
  'BULK_COMMIT_REPLAY_DEDUPLICATED', 'evaluateInstitutionalPassengerSubstitution',
  'evaluateInstitutionalCancellation', 'institutionalReportMayRun',
  'evaluatePassengerMembershipEnd', 'institutionalTransportAcceptanceScenarioMayPass',
  'ROSTER_OWNS_PASSENGER_IDENTITY = false', 'TEMPLATE_IS_CANONICAL_BOOKING = false',
  'ORGANISATION_PORTAL_MAY_RELABEL_ACTIVE_JOURNEY_PASSENGER = false',
  'PASSENGER_NOT_READY_IS_AUTOMATIC_NO_SHOW = false',
  'INSTITUTIONAL_ENDPOINT_WRITES_JOURNEY_OR_PAYMENT = false',
  'INSTITUTIONAL_TRANSPORT_MUTATIONS_ENABLED = false'
]) if (!domain.includes(boundary)) errors.push(`Missing institutional transport domain boundary: ${boundary}`);

const contracts = readFileSync(join(root, 'packages/contracts/src/institutional-transport.ts'), 'utf8');
for (const truth of [
  'InstitutionalTransportCapabilitiesProjection', 'InstitutionalTransportExceptionSummaryProjection',
  'InstitutionalTransportContextProjection', 'passengerIdentityIndependentFromOrganisation: true',
  'bookingAndFundingAuthoritySeparated: true', 'canonicalBookingRequiredPerOccurrence: true',
  'crossTenantDuplicateDisclosureAllowed: false', 'templateIsCanonicalBooking: false',
  'portalMayRelabelActiveJourneyPassenger: false', 'institutionalTransportMutationsEnabled: false',
  'tenantScopedByAuthenticatedMembership: true', 'minimumTransportDataOnly: true',
  'portalMutationEnabled: false', 'externalExecutionEnabled: false'
]) if (!contracts.includes(truth)) errors.push(`Missing institutional transport contract truth: ${truth}`);

const service = readFileSync(join(root, 'services/api/src/modules/institutional-transport/institutional-transport-service.ts'), 'utf8');
for (const truth of [
  'getInstitutionalTransportCapabilities', 'getActorInstitutionalTransportContext',
  'WHERE membership.person_id = $1', 'membership.organisation_id = $2',
  "membership.status = 'ACTIVE'", 'membership.valid_from <= now()',
  'LIMIT 50', 'tenantScopedByAuthenticatedMembership: true',
  'minimumTransportDataOnly: true', 'canonicalBookingPerOccurrence: true',
  'portalMutationEnabled: false', 'externalExecutionEnabled: false'
]) if (!service.includes(truth)) errors.push(`Missing institutional transport service boundary: ${truth}`);
if (/\b(?:fetch|axios)\s*\(/i.test(service)) errors.push('Institutional transport service contains an external call');

const routes = readFileSync(join(root, 'services/api/src/modules/institutional-transport/routes.ts'), 'utf8');
for (const path of ['/v1/institutional-transport/capabilities', '/v1/organisations/:organisationId/institutional-transport']) {
  if (!routes.includes(path)) errors.push(`Institutional transport API route missing: ${path}`);
}
for (const gate of ["'VIEW_PROFILE'", 'requirePrincipal', 'INVALID_ORGANISATION_ID', 'INSTITUTIONAL_TRANSPORT_CONTEXT_NOT_FOUND']) {
  if (!routes.includes(gate)) errors.push(`Institutional transport API gate missing: ${gate}`);
}
if (/app\.(?:post|put|patch|delete)\(/.test(routes)) errors.push('Institutional transport routes expose an unapproved mutation');

const config = readFileSync(join(root, 'services/api/src/config.ts'), 'utf8');
for (const truth of [
  "readonly institutionalTransportMutationMode: 'disabled'",
  'INSTITUTIONAL_TRANSPORT_MUTATION_MODE must remain disabled',
  "institutionalTransportMutationMode: 'disabled'"
]) if (!config.includes(truth)) errors.push(`Configuration missing institutional transport boundary: ${truth}`);
const environment = readFileSync(join(root, '.env.example'), 'utf8');
if (!environment.includes('INSTITUTIONAL_TRANSPORT_MUTATION_MODE=disabled')) errors.push('Environment missing Phase 0.18 disabled truth');
const main = readFileSync(join(root, 'services/api/src/main.ts'), 'utf8');
for (const truth of [
  'registerInstitutionalTransportRoutes', 'engineering-phase-0.18',
  'NOT_REQUIRED_FOR_PHASE_0_18_INSTITUTIONAL_TRANSPORT_FOUNDATION',
  'institutionalTransportMutation'
]) if (!main.includes(truth)) errors.push(`API bootstrap missing Phase 0.18 value: ${truth}`);

const portal = readFileSync(join(root, 'apps/organisation-portal/src/App.tsx'), 'utf8');
for (const truth of [
  'ENGINEERING PHASE 0.18', 'Every recurring occurrence is its own canonical Booking',
  'template does not reserve a Driver, create Finance liability or become an active Journey',
  'Readiness, recurrence and bulk work stay explicit', 'PASSENGER_NOT_READY is not automatically a no-show',
  'Institutional mutations and external execution remain disabled'
]) if (!portal.includes(truth)) errors.push(`Organisation Portal Part 2 boundary missing: ${truth}`);
const client = readFileSync(join(root, 'apps/organisation-portal/src/organisation-api.ts'), 'utf8');
for (const truth of ['readInstitutionalTransportCapabilities', 'readInstitutionalTransportContext', 'Authorization: `Bearer']) {
  if (!client.includes(truth)) errors.push(`Organisation Portal Part 2 client truth missing: ${truth}`);
}
const controlRoom = readFileSync(join(root, 'apps/control-room/src/App.tsx'), 'utf8');
for (const truth of [
  'Institutional preparation never replaces Booking or Journey truth',
  'Every occurrence is a separate Booking', 'Active Journeys cannot be changed by editing a series',
  'PASSENGER_NOT_READY as an automatic no-show', 'all institutional mutation execution remains disabled'
]) if (!controlRoom.includes(truth)) errors.push(`Control Room Part 2 boundary missing: ${truth}`);

const api = readFileSync(join(root, 'openapi/dazat-api.yaml'), 'utf8');
for (const path of ['/v1/institutional-transport/capabilities:', '/v1/organisations/{organisationId}/institutional-transport:']) {
  if (!api.includes(path)) errors.push(`OpenAPI Phase 0.18 path missing: ${path}`);
}
for (const truth of [
  'Every actual occurrence is its own canonical Booking', 'Passenger identity remains independent',
  'PASSENGER_NOT_READY is not automatically no-show', 'InstitutionalTransportCapabilitiesProjection',
  'InstitutionalTransportContextProjection', 'canonicalBookingRequiredPerOccurrence',
  'institutionalTransportMutationsEnabled', 'ORG-REC-001', 'BookingOccurrenceGenerated.v1'
]) if (!api.includes(truth)) errors.push(`OpenAPI Phase 0.18 truth missing: ${truth}`);
if (!api.includes('version: 0.0.18')) errors.push('OpenAPI is not versioned at 0.0.18');

let currentVersion = null;
for (const rel of [
  'package.json', 'packages/domain/package.json', 'packages/contracts/package.json', 'services/api/package.json',
  'apps/driver/package.json', 'apps/rider/package.json', 'apps/control-room/package.json', 'apps/organisation-portal/package.json'
]) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.version !== '0.0.18') errors.push(`${rel} is not versioned at 0.0.18`);
  currentVersion ??= parsed.version;
  if (parsed.version !== currentVersion) errors.push(`${rel} is not aligned to the current checkpoint version`);
}
const contractsPackage = JSON.parse(readFileSync(join(root, 'packages/contracts/package.json'), 'utf8'));
if (contractsPackage.dependencies['@dazat/domain'] !== currentVersion) errors.push('Contracts domain dependency is not aligned');
const apiPackage = JSON.parse(readFileSync(join(root, 'services/api/package.json'), 'utf8'));
if (apiPackage.dependencies['@dazat/domain'] !== currentVersion || apiPackage.dependencies['@dazat/contracts'] !== currentVersion) errors.push('API internal dependencies are not aligned');
for (const rel of ['apps/driver/package.json', 'apps/rider/package.json', 'apps/organisation-portal/package.json']) {
  const parsed = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  if (parsed.dependencies['@dazat/contracts'] !== currentVersion) errors.push(`${rel} contract dependency is not aligned`);
}

if (errors.length) {
  console.error('DAZAT Engineering Phase 0.18 verification FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('DAZAT Engineering Phase 0.18 verification PASSED');
console.log(`Checked ${required.length} checkpoint files plus passenger, authority, recurrence, scheduling, readiness, bulk, exception and disabled-mutation boundaries.`);
