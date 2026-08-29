import type { BookingDispatchProjection, StartDispatchResult } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string };
  if (!response.ok) throw new Error(body.code ?? 'Dispatch is unavailable.');
  return body;
}

export async function startBookingDispatch(sessionToken: string, bookingId: string): Promise<StartDispatchResult> {
  return json(await fetch(`${API_BASE_URL}/v1/bookings/${bookingId}/dispatch`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken}`,
      'idempotency-key': requestKey('start-booking-dispatch')
    }
  }));
}

export async function getBookingDispatch(sessionToken: string, bookingId: string): Promise<BookingDispatchProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/bookings/${bookingId}/dispatch`, {
    headers: { authorization: `Bearer ${sessionToken}` }
  }));
}
