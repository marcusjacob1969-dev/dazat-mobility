import type { CoreJourneyMilestone, CoreJourneyProgressProjection } from '@dazat/contracts';
import type { BookingStatus } from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class CoreJourneyNotFoundError extends Error {}

interface ProgressRow {
  booking_id: string;
  booking_status: BookingStatus;
  fare_agreement_id: string | null;
  dispatch_status: string | null;
  assignment_id: string | null;
  journey_id: string | null;
  journey_status: string | null;
  arrival_accepted: boolean | null;
  ridecheck_status: string | null;
  payment_intent_status: string | null;
}

const CLOSED_EXCEPTION_STATUSES = new Set([
  'RIDER_CANCELLED', 'DRIVER_CANCELLED', 'OPERATIONS_CANCELLED',
  'RIDER_NO_SHOW', 'DRIVER_NO_SHOW', 'REFUNDED'
]);

const SUPPORT_EXCEPTION_STATUSES = new Set([
  'NO_ELIGIBLE_DRIVER', 'PAYMENT_FAILED', 'SAFETY_HOLD', 'ACTIVE_INCIDENT',
  'BREAKDOWN', 'REASSIGNMENT_REQUIRED', 'REPLACEMENT_SEARCHING',
  'REPLACEMENT_ASSIGNED', 'REFUND_PENDING'
]);

function milestone(name: CoreJourneyMilestone['name'], status: CoreJourneyMilestone['status']): CoreJourneyMilestone {
  return { name, status };
}

export function projectCoreJourneyProgress(row: ProgressRow): CoreJourneyProgressProjection {
  const closedException = CLOSED_EXCEPTION_STATUSES.has(row.booking_status);
  const supportException = SUPPORT_EXCEPTION_STATUSES.has(row.booking_status);
  const interrupted = closedException || supportException;
  const bookingConfirmed = !['DRAFT', 'QUOTE_CREATED', 'AWAITING_CONFIRMATION'].includes(row.booking_status);
  const journeyComplete = row.journey_status === 'COMPLETED';
  const financeBlockedByProvider = Boolean(row.payment_intent_status && row.payment_intent_status !== 'CAPTURED');
  const milestones: CoreJourneyMilestone[] = [
    milestone('BOOKING', bookingConfirmed ? 'COMPLETED' : 'IN_PROGRESS'),
    milestone('FARE_AGREEMENT', row.fare_agreement_id ? 'COMPLETED' : 'NOT_STARTED'),
    milestone('DISPATCH', row.assignment_id ? 'COMPLETED' : row.dispatch_status ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('DRIVER_ASSIGNED', row.assignment_id ? 'COMPLETED' : 'NOT_STARTED'),
    milestone('ARRIVAL', row.arrival_accepted ? 'COMPLETED' : row.journey_id ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('RIDECHECK', row.ridecheck_status === 'VERIFIED' ? 'COMPLETED' : row.ridecheck_status === 'LOCKED' ? 'BLOCKED' : row.ridecheck_status ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('JOURNEY', journeyComplete ? 'COMPLETED' : row.journey_id ? 'IN_PROGRESS' : 'NOT_STARTED'),
    milestone('FINANCE', row.payment_intent_status === 'CAPTURED' ? 'COMPLETED' : financeBlockedByProvider ? 'BLOCKED' : journeyComplete ? 'NOT_STARTED' : 'BLOCKED')
  ];
  const safeMilestones = interrupted
    ? milestones.map((item, index) => index === 0 ? item : milestone(item.name, item.status === 'COMPLETED' ? 'COMPLETED' : 'BLOCKED'))
    : milestones;
  const next = safeMilestones.find((item) => item.status !== 'COMPLETED');
  return {
    bookingId: row.booking_id,
    bookingStatus: row.booking_status,
    ...(row.journey_id ? { journeyId: row.journey_id } : {}),
    ...(row.journey_status ? { journeyStatus: row.journey_status } : {}),
    ...(row.payment_intent_status ? { paymentIntentStatus: row.payment_intent_status } : {}),
    disposition: closedException ? 'CLOSED' : supportException ? 'SUPPORT_REQUIRED' : journeyComplete && row.payment_intent_status === 'CAPTURED' ? 'CLOSED' : 'ACTIVE',
    ...(interrupted ? { interruptionReason: row.booking_status } : {}),
    productionChargingEnabled: false,
    milestones: safeMilestones,
    nextAction: closedException
      ? 'JOURNEY_CLOSED'
      : supportException
        ? 'SUPPORT_REQUIRED'
        : financeBlockedByProvider
          ? 'PAYMENT_PROVIDER_UNAVAILABLE'
          : next?.name ?? 'JOURNEY_CLOSED'
  };
}

async function readProgress(pool: DatabasePool, bookingId: string, actorId: string, accessPredicate: string, scopeParameters: readonly string[] = []): Promise<CoreJourneyProgressProjection> {
  const result = await pool.query<ProgressRow>(
    `SELECT b.id AS booking_id, b.status AS booking_status, fa.id AS fare_agreement_id,
            attempt.status AS dispatch_status, assignment.id AS assignment_id,
            j.id AS journey_id, j.status AS journey_status,
            arrival.accepted AS arrival_accepted, ridecheck.status AS ridecheck_status,
            payment_intent.status AS payment_intent_status
       FROM booking.booking b
       LEFT JOIN pricing.fare_agreement fa ON fa.booking_id = b.id
       LEFT JOIN LATERAL (SELECT id, status FROM dispatch.dispatch_attempt WHERE booking_id = b.id ORDER BY attempt_number DESC LIMIT 1) attempt ON true
       LEFT JOIN LATERAL (SELECT id FROM dispatch.driver_assignment WHERE dispatch_attempt_id = attempt.id ORDER BY assigned_at DESC LIMIT 1) assignment ON true
       LEFT JOIN journey.journey j ON j.booking_id = b.id
       LEFT JOIN LATERAL (SELECT accepted FROM journey.arrival_evidence WHERE journey_id = j.id ORDER BY evaluated_at DESC LIMIT 1) arrival ON true
       LEFT JOIN LATERAL (SELECT status FROM journey.ridecheck_session WHERE journey_id = j.id ORDER BY created_at DESC LIMIT 1) ridecheck ON true
       LEFT JOIN LATERAL (SELECT status FROM finance.payment_intent WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1) payment_intent ON true
      WHERE b.id = $1 AND ${accessPredicate}`,
    [bookingId, actorId, ...scopeParameters]
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

export function getControlRoomCoreJourneyProgress(pool: DatabasePool, bookingId: string, controlledHandoverId: string, actor: AuthenticatedPrincipal): Promise<CoreJourneyProgressProjection> {
  return readProgress(pool, bookingId, actor.personId,
    `EXISTS (
       SELECT 1 FROM operations.control_room_task_scope task
       JOIN operations.control_room_role_assignment role_assignment ON role_assignment.id = task.role_assignment_id
       JOIN operations.driver_fatigue_handover handover ON handover.id = task.subject_id
       JOIN journey.journey scoped_journey ON scoped_journey.id = handover.journey_id
       WHERE task.operator_person_id = $2 AND task.subject_id = $3
         AND task.purpose = 'DRIVER_FATIGUE_HANDOVER'
         AND task.valid_from <= now() AND task.valid_until > now()
         AND role_assignment.operator_person_id = $2
         AND role_assignment.valid_from <= now() AND role_assignment.valid_until > now()
         AND scoped_journey.booking_id = b.id
     )`, [controlledHandoverId]);
}
