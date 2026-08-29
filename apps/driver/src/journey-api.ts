import type {
  ArrivalResult,
  DriverAcknowledgementResult,
  DriverLocationObservationResult,
  JourneyCommandResult,
  JourneyLiveProjection,
  VerifyRideCheckResult
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clientObservationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const digit = value === 'x' ? random : (random & 0x3) | 0x8;
    return digit.toString(16);
  });
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

export async function acknowledgeAssignment(sessionToken: string, bookingId: string): Promise<DriverAcknowledgementResult> {
  return json(await fetch(`${API_BASE_URL}/v1/bookings/${bookingId}/journey/acknowledge`, {
    method: 'POST', headers: { ...auth(sessionToken), 'idempotency-key': requestKey('acknowledge-assignment') }
  }));
}

export async function sendPickupLocation(
  sessionToken: string,
  journeyId: string,
  latitude: number,
  longitude: number
): Promise<DriverLocationObservationResult> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/location-observations`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json' },
    body: JSON.stringify({
      clientObservationId: clientObservationId(), latitude, longitude,
      observedAt: new Date().toISOString(), source: 'DEVICE_GPS', accuracyMetres: 20, confidence: 0.9
    })
  }));
}

export async function markArrived(sessionToken: string, journeyId: string): Promise<ArrivalResult> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/arrived`, {
    method: 'POST', headers: { ...auth(sessionToken), 'idempotency-key': requestKey('arrived') }
  }));
}

export async function verifyPickupRideCheck(
  sessionToken: string,
  journeyId: string,
  rideCheckSessionId: string,
  code: string
): Promise<VerifyRideCheckResult> {
  const response = await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/ridecheck/verify`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('ridecheck-verify') },
    body: JSON.stringify({ rideCheckSessionId, code })
  });
  const body = await response.json() as VerifyRideCheckResult & { code?: string };
  if (response.status === 409 && body.rideCheckSessionId) return body;
  if (!response.ok) throw new Error(body.code ?? 'RIDECHECK_VERIFICATION_FAILED');
  return body;
}

export async function beginJourney(sessionToken: string, journeyId: string): Promise<JourneyCommandResult> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/start`, {
    method: 'POST', headers: { ...auth(sessionToken), 'idempotency-key': requestKey('journey-start') }
  }));
}

export async function getDriverJourney(sessionToken: string, journeyId: string): Promise<JourneyLiveProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/journeys/${journeyId}/live`, { headers: auth(sessionToken) }));
}
