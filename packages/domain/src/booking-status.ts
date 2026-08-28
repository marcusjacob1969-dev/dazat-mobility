export const AUTHORITATIVE_BOOKING_STATUSES = [
  'DRAFT',
  'QUOTE_CREATED',
  'AWAITING_CONFIRMATION',
  'CONFIRMED',
  'SCHEDULED',
  'READY_FOR_DISPATCH',
  'SEARCHING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'AWAITING_RIDECHECK',
  'PASSENGER_VERIFIED',
  'IN_PROGRESS',
  'ARRIVING',
  'COMPLETED',
  'PAYMENT_PROCESSING',
  'PAID',
  'CLOSED'
] as const;

export const EXCEPTION_BOOKING_STATUSES = [
  'NO_ELIGIBLE_DRIVER',
  'RIDER_CANCELLED',
  'DRIVER_CANCELLED',
  'OPERATIONS_CANCELLED',
  'RIDER_NO_SHOW',
  'DRIVER_NO_SHOW',
  'PAYMENT_FAILED',
  'SAFETY_HOLD',
  'ACTIVE_INCIDENT',
  'BREAKDOWN',
  'REASSIGNMENT_REQUIRED',
  'REPLACEMENT_SEARCHING',
  'REPLACEMENT_ASSIGNED',
  'REFUND_PENDING',
  'REFUNDED'
] as const;

export type AuthoritativeBookingStatus = typeof AUTHORITATIVE_BOOKING_STATUSES[number];
export type ExceptionBookingStatus = typeof EXCEPTION_BOOKING_STATUSES[number];
export type BookingStatus = AuthoritativeBookingStatus | ExceptionBookingStatus;

// Phase 0 implements only the canonical forward spine. Exception workflows are deliberately
// not guessed here; they will be added from their dedicated Booking/Safety/Finance commands.
const FORWARD_TRANSITIONS: Readonly<Record<AuthoritativeBookingStatus, readonly BookingStatus[]>> = {
  DRAFT: ['QUOTE_CREATED'],
  QUOTE_CREATED: ['AWAITING_CONFIRMATION'],
  AWAITING_CONFIRMATION: ['CONFIRMED'],
  CONFIRMED: ['SCHEDULED', 'READY_FOR_DISPATCH'],
  SCHEDULED: ['READY_FOR_DISPATCH'],
  READY_FOR_DISPATCH: ['SEARCHING_FOR_DRIVER'],
  SEARCHING_FOR_DRIVER: ['DRIVER_ASSIGNED', 'NO_ELIGIBLE_DRIVER'],
  DRIVER_ASSIGNED: ['DRIVER_EN_ROUTE'],
  DRIVER_EN_ROUTE: ['DRIVER_ARRIVED'],
  DRIVER_ARRIVED: ['AWAITING_RIDECHECK'],
  AWAITING_RIDECHECK: ['PASSENGER_VERIFIED'],
  PASSENGER_VERIFIED: ['IN_PROGRESS'],
  IN_PROGRESS: ['ARRIVING'],
  ARRIVING: ['COMPLETED'],
  COMPLETED: ['PAYMENT_PROCESSING'],
  PAYMENT_PROCESSING: ['PAID', 'PAYMENT_FAILED'],
  PAID: ['CLOSED'],
  CLOSED: []
};

export function isExceptionBookingStatus(status: BookingStatus): status is ExceptionBookingStatus {
  return (EXCEPTION_BOOKING_STATUSES as readonly string[]).includes(status);
}

export function canUseCanonicalForwardTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (isExceptionBookingStatus(from)) return false;
  return FORWARD_TRANSITIONS[from].includes(to);
}

export function assertCanonicalForwardTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canUseCanonicalForwardTransition(from, to)) {
    throw new Error(`Invalid canonical Booking transition: ${from} -> ${to}`);
  }
}
