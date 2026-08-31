import {
  BOOKING_SERIES_CHANGE_SCOPES,
  BULK_PASSENGER_IMPORT_STATES,
  INSTITUTIONAL_CANCELLATION_REASONS,
  INSTITUTIONAL_SERVICE_TYPES,
  INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS,
  INSTITUTIONAL_TRANSPORT_API_PATHS,
  INSTITUTIONAL_TRANSPORT_COMMANDS,
  INSTITUTIONAL_TRANSPORT_EVENTS,
  INSTITUTIONAL_TRANSPORT_P0_REQUIREMENTS,
  ORGANISATION_PASSENGER_MEMBERSHIP_STATES,
  ORGANISATION_TRANSPORT_EXCEPTION_TYPES
} from '@dazat/domain';
import type {
  InstitutionalTransportCapabilitiesProjection,
  InstitutionalTransportContextProjection,
  InstitutionalTransportExceptionSummaryProjection
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export function getInstitutionalTransportCapabilities(): InstitutionalTransportCapabilitiesProjection {
  return {
    passengerMembershipStates: ORGANISATION_PASSENGER_MEMBERSHIP_STATES,
    serviceTypes: INSTITUTIONAL_SERVICE_TYPES,
    seriesChangeScopes: BOOKING_SERIES_CHANGE_SCOPES,
    bulkImportStates: BULK_PASSENGER_IMPORT_STATES,
    cancellationReasons: INSTITUTIONAL_CANCELLATION_REASONS,
    exceptionTypes: ORGANISATION_TRANSPORT_EXCEPTION_TYPES,
    conceptualApiPaths: INSTITUTIONAL_TRANSPORT_API_PATHS,
    conceptualCommands: INSTITUTIONAL_TRANSPORT_COMMANDS,
    events: INSTITUTIONAL_TRANSPORT_EVENTS,
    p0Requirements: INSTITUTIONAL_TRANSPORT_P0_REQUIREMENTS,
    acceptanceScenarios: INSTITUTIONAL_TRANSPORT_ACCEPTANCE_SCENARIOS,
    passengerIdentityIndependentFromOrganisation: true,
    bookingAndFundingAuthoritySeparated: true,
    canonicalBookingRequiredPerOccurrence: true,
    accessibilityAndSafeguardingPersistThroughRecurrence: true,
    crossTenantDuplicateDisclosureAllowed: false,
    templateIsCanonicalBooking: false,
    templateReservesDriver: false,
    templateCreatesFinanceLiability: false,
    portalMayRelabelActiveJourneyPassenger: false,
    institutionalEndpointWritesJourneyOrPayment: false,
    institutionalTransportMutationsEnabled: false
  };
}

type InstitutionalTransportContextRow = {
  organisation_id: string;
  managed_passenger_count: string;
  active_passenger_membership_count: string;
  active_funding_authorisation_count: string;
  active_booking_template_count: string;
  active_booking_series_count: string;
  future_occurrence_count: string;
  passenger_not_ready_count: string;
  open_exception_count: string;
  exceptions: Array<{
    exceptionId: string;
    exceptionType: string;
    status: InstitutionalTransportExceptionSummaryProjection['status'];
    priority: InstitutionalTransportExceptionSummaryProjection['priority'];
    nextAction: string;
    attentionAt: string;
    ownerPresent: boolean;
  }>;
};

export async function getActorInstitutionalTransportContext(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  organisationId: string
): Promise<InstitutionalTransportContextProjection | null> {
  const result = await pool.query<InstitutionalTransportContextRow>(
    `SELECT organisation.id AS organisation_id,
            (SELECT count(*)::text FROM organisation.managed_passenger_profile passenger
              WHERE passenger.organisation_id = organisation.id
                AND passenger.status IN ('ACTIVE','TEMPORARILY_INACTIVE')) AS managed_passenger_count,
            (SELECT count(*)::text FROM organisation.organisation_passenger_membership passenger_membership
              WHERE passenger_membership.organisation_id = organisation.id
                AND passenger_membership.status = 'ACTIVE'
                AND passenger_membership.valid_from <= now()
                AND (passenger_membership.valid_until IS NULL OR passenger_membership.valid_until > now())) AS active_passenger_membership_count,
            (SELECT count(*)::text FROM organisation.funding_authorisation_version funding
              WHERE funding.organisation_id = organisation.id AND funding.status = 'ACTIVE'
                AND funding.effective_from <= now() AND (funding.effective_to IS NULL OR funding.effective_to > now())) AS active_funding_authorisation_count,
            (SELECT count(*)::text FROM organisation.booking_template_version template
              WHERE template.organisation_id = organisation.id AND template.status = 'ACTIVE'
                AND template.effective_from <= now() AND (template.effective_to IS NULL OR template.effective_to > now())) AS active_booking_template_count,
            (SELECT count(*)::text FROM organisation.booking_series series
              WHERE series.organisation_id = organisation.id AND series.status = 'ACTIVE') AS active_booking_series_count,
            (SELECT count(*)::text FROM organisation.booking_occurrence occurrence
              WHERE occurrence.organisation_id = organisation.id AND occurrence.service_date >= current_date) AS future_occurrence_count,
            (SELECT count(*)::text
               FROM organisation.passenger_readiness_event readiness
              WHERE readiness.organisation_id = organisation.id AND readiness.readiness = 'NOT_READY'
                AND NOT EXISTS (
                  SELECT 1 FROM organisation.passenger_readiness_event newer
                   WHERE newer.organisation_id = readiness.organisation_id
                     AND newer.canonical_booking_id = readiness.canonical_booking_id
                     AND newer.state_version > readiness.state_version
                )) AS passenger_not_ready_count,
            (SELECT count(*)::text FROM organisation.organisation_transport_exception exception
              WHERE exception.organisation_id = organisation.id AND exception.status IN ('OPEN','IN_PROGRESS','WAITING')) AS open_exception_count,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'exceptionId', scoped_exception.id,
                'exceptionType', scoped_exception.exception_type,
                'status', scoped_exception.status,
                'priority', scoped_exception.priority,
                'nextAction', scoped_exception.next_action,
                'attentionAt', scoped_exception.attention_at,
                'ownerPresent', scoped_exception.owner_person_id IS NOT NULL
              ) ORDER BY scoped_exception.attention_at, scoped_exception.id)
              FROM (SELECT * FROM organisation.organisation_transport_exception exception
                     WHERE exception.organisation_id = organisation.id
                       AND exception.status IN ('OPEN','IN_PROGRESS','WAITING')
                     ORDER BY exception.attention_at, exception.id LIMIT 50) scoped_exception), '[]'::jsonb) AS exceptions
       FROM organisation.organisation_user_membership membership
       JOIN organisation.organisation organisation ON organisation.id = membership.organisation_id
      WHERE membership.person_id = $1
        AND membership.organisation_id = $2
        AND membership.status = 'ACTIVE'
        AND membership.valid_from <= now()
        AND (membership.valid_until IS NULL OR membership.valid_until > now())`,
    [actor.personId, organisationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    organisationId: row.organisation_id,
    managedPassengerCount: Number(row.managed_passenger_count),
    activePassengerMembershipCount: Number(row.active_passenger_membership_count),
    activeFundingAuthorisationCount: Number(row.active_funding_authorisation_count),
    activeBookingTemplateCount: Number(row.active_booking_template_count),
    activeBookingSeriesCount: Number(row.active_booking_series_count),
    futureOccurrenceCount: Number(row.future_occurrence_count),
    passengerNotReadyCount: Number(row.passenger_not_ready_count),
    openExceptionCount: Number(row.open_exception_count),
    exceptions: row.exceptions.map((exception) => ({
      ...exception,
      attentionAt: new Date(exception.attentionAt).toISOString()
    })),
    tenantScopedByAuthenticatedMembership: true,
    minimumTransportDataOnly: true,
    canonicalBookingPerOccurrence: true,
    portalMutationEnabled: false,
    externalExecutionEnabled: false
  };
}
