import type { JourneyLiveProjection, StartRideCheckResult } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${body.code ?? 'JOURNEY_REQUEST_FAILED'}${body.message ? `: ${body.message}` : ''}`);
  return body;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function getBookingJourney(sessionToken: string, bookingId: string): Promise<JourneyLiveProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/bookings/${bookingId}/journey`, { headers: auth(sessionToken) }));
}

export async function startPassengerRideCheck(sessionToken: string, journeyId: string): Promise<StartRideCheckResult> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/ridecheck/start`, {
    method: 'POST', headers: { ...auth(sessionToken), 'idempotency-key': requestKey('ridecheck-start') }
  }));
}
