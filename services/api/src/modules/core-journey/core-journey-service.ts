import type { CoreJourneyMilestone, CoreJourneyProgressProjection } from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class CoreJourneyNotFoundError extends Error {}

interface ProgressRow {
  booking_id: string;
  booking_status: string;
  fare_agreement_id: string | null;
  dispatch_status: string | null;
  assignment_id: string | null;
  journey_id: string | null;
  journey_status: string | null;
  arrival_accepted: boolean | null;
  ridecheck_status: string | null;
  payment_intent_status: string | null;
}

function milestone(name: CoreJourneyMilestone['name'], status: CoreJourneyMilestone['status']): CoreJourneyMilestone {
  return { name, status };
}

export function projectCoreJourneyProgress(row: ProgressRow): CoreJourneyProgressProjection {
  const bookingConfirmed = !['DRAFT', 'QUOTED'].includes(row.booking_status);
  const journeyComplete = row.journey_status === 'COMPLETED';
  const milestones: CoreJourneyMilestone[] = [
    milestone('BOOKING', bookingConfirmed ? 'COMPLETED' : 'IN_PROGRESS'),
    milestone('FARE_AGREEMENT', row.fare_agreement_id ? 'COMPLETED' : 'NOT_STARTED'),
    milestone('DISPATCH', row.assignment_id ? 'COMPLETED' : row.dispatch_status ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('DRIVER_ASSIGNED', row.assignment_id ? 'COMPLETED' : 'NOT_STARTED'),
    milestone('ARRIVAL', row.arrival_accepted ? 'COMPLETED' : row.journey_id ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('RIDECHECK', row.ridecheck_status === 'VERIFIED' ? 'COMPLETED' : row.ridecheck_status === 'LOCKED' ? 'BLOCKED' : row.ridecheck_status ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('JOURNEY', journeyComplete ? 'COMPLETED' : row.journey_id ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('FINANCE', row.payment_intent_status ? (row.payment_intent_status === 'CAPTURED' ? 'COMPLETED' : 'IN_PROGRESS') : journeyComplete ? 'NOT_STARTED' : 'BLOCKED')
  ];
  const next = milestones.find((item) => item.status !== 'COMPLETED');
  return {
    bookingId: row.booking_id,
    bookingStatus: row.booking_status,
    ...(row.journey_id ? { journeyId: row.journey_id } : {}),
    ...(row.journey_status ? { journeyStatus: row.journey_status } : {}),
    ...(row.payment_intent_status ? { paymentIntentStatus: row.payment_intent_status } : {}),
    productionChargingEnabled: false,
    milestones,
    nextAction: next?.name ?? 'JOURNEY_CLOSED'
  };
}

async function readProgress(pool: DatabasePool, bookingId: string, actorId: string, accessPredicate: string): Promise<CoreJourneyProgressProjection> {
  const result = await pool.query<ProgressRow>(
    `SELECT b.id AS booking_id, b.status AS booking_status, fa.id AS fare_agreement_id,
            attempt.status AS dispatch_status, assignment.id AS assignment_id,
            j.id AS journey_id, j.status AS journey_status,
            arrival.accepted AS arrival_accepted, ridecheck.status AS ridecheck_status,
            payment_intent.status AS payment_intent_status
       FROM booking.booking b
       LEFT JOIN pricing.fare_agreement fa ON fa.booking_id = b.id
       LEFT JOIN LATERAL (SELECT id, status FROM dispatch.dispatch_attempt WHERE booking_id = b.id ORDER BY attempt_number DESC LIMIT 1) attempt ON true
       LEFT JOIN dispatch.driver_assignment assignment ON assignment.dispatch_attempt_id = attempt.id AND assignment.status = 'ACTIVE'
       LEFT JOIN journey.journey j ON j.booking_id = b.id
       LEFT JOIN LATERAL (SELECT accepted FROM journey.arrival_evidence WHERE journey_id = j.id ORDER BY evaluated_at DESC LIMIT 1) arrival ON true
       LEFT JOIN LATERAL (SELECT status FROM journey.ridecheck_session WHERE journey_id = j.id ORDER BY created_at DESC LIMIT 1) ridecheck ON true
       LEFT JOIN LATERAL (SELECT status FROM finance.payment_intent WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) payment_intent ON true
      WHERE b.id = $1 AND ${accessPredicate}`,
    [bookingId, actorId]
  );
  if (!result.rowCount) throw new CoreJourneyNotFoundError('Journey progress is unavailable');
  return projectCoreJourneyProgress(result.rows[0]!);
}

export function getCoreJourneyProgress(pool: DatabasePool, bookingId: string, actor: AuthenticatedPrincipal): Promise<CoreJourneyProgressProjection> {
  return readProgress(pool, bookingId, actor.personId,
    "EXISTS (SELECT 1 FROM booking.booking_party party WHERE party.booking_id = b.id AND party.person_id = $2 AND party.role IN ('BOOKER','PASSENGER','PAYER'))");
}

export function getDriverCoreJourneyProgress(pool: DatabasePool, bookingId: string, actor: AuthenticatedPrincipal): Promise<CoreJourneyProgressProjection> {
  if (!actor.driverProfileId) throw new CoreJourneyNotFoundError('Driver progress is unavailable');
  return readProgress(pool, bookingId, actor.driverProfileId,
    "EXISTS (SELECT 1 FROM dispatch.driver_assignment permitted_assignment WHERE permitted_assignment.booking_id = b.id AND permitted_assignment.driver_profile_id = $2)");
}
