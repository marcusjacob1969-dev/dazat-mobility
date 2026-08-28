import type {
  BookingQuoteResult,
  BookingSummary,
  ConfirmBookingResult,
  CreateRiderBookingRequest
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(path: string, sessionToken: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${sessionToken}`,
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`DAZAT API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function createRiderBooking(
  sessionToken: string,
  input: CreateRiderBookingRequest
): Promise<BookingSummary> {
  return request<BookingSummary>('/v1/bookings', sessionToken, {
    method: 'POST',
    headers: { 'idempotency-key': requestKey('rider-booking') },
    body: JSON.stringify(input)
  });
}

export function quoteRiderBooking(sessionToken: string, bookingId: string): Promise<BookingQuoteResult> {
  return request<BookingQuoteResult>(`/v1/bookings/${bookingId}/quote`, sessionToken, {
    method: 'POST',
    headers: { 'idempotency-key': requestKey('rider-quote') }
  });
}

export function confirmRiderBooking(
  sessionToken: string,
  bookingId: string,
  quoteId: string
): Promise<ConfirmBookingResult> {
  return request<ConfirmBookingResult>(`/v1/bookings/${bookingId}/confirm`, sessionToken, {
    method: 'POST',
    headers: { 'idempotency-key': requestKey('rider-confirm') },
    body: JSON.stringify({ quoteId })
  });
}
