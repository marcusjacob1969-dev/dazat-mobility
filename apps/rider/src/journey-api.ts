import type {
  ActiveJourneyProjection,
  RouteChangeResult,
  SafetySignalResult,
  StartRideCheckResult
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; blockers?: string[]; message?: string };
  if (!response.ok) {
    const context = body.blockers?.length ? `: ${body.blockers.join(', ')}` : body.message ? `: ${body.message}` : '';
    throw new Error(`${body.code ?? 'JOURNEY_REQUEST_FAILED'}${context}`);
  }
  return body;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function getBookingJourney(sessionToken: string, bookingId: string): Promise<ActiveJourneyProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/bookings/${bookingId}/journey`, { headers: auth(sessionToken) }));
}

export async function requestJourneyStop(
  sessionToken: string,
  journey: ActiveJourneyProjection,
  location: { latitude: number; longitude: number; displayLabel: string }
): Promise<RouteChangeResult> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journey.journeyId}/stop-requests`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('stop-request') },
    body: JSON.stringify({ location, expectedJourneyVersion: journey.aggregateVersion, reasonCode: 'PASSENGER_REQUEST' })
  }));
}

export async function sendRiderSafetySignal(
  sessionToken: string,
  journeyId: string,
  signal: 'SOS' | 'SILENT_ASSISTANCE' | 'ROUTE_CONCERN',
  routeConcernCategory?: 'CHECK_ROUTE' | 'WRONG_DESTINATION' | 'FEEL_UNSAFE' | 'UNEXPECTED_STOP' | 'OTHER'
): Promise<SafetySignalResult> {
  const path = signal === 'SOS'
    ? '/v1/safety/signals/sos'
    : signal === 'SILENT_ASSISTANCE'
      ? '/v1/safety/signals/silent-assistance'
      : '/v1/safety/route-concerns';
  return json(await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey(`rider-${signal.toLowerCase()}`) },
    body: JSON.stringify({ journeyId, ...(routeConcernCategory ? { routeConcernCategory } : {}) })
  }));
}

export async function startPassengerRideCheck(sessionToken: string, journeyId: string): Promise<StartRideCheckResult> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/ridecheck/start`, {
    method: 'POST', headers: { ...auth(sessionToken), 'idempotency-key': requestKey('ridecheck-start') }
  }));
}
