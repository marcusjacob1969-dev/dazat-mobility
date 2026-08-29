import type {
  AcceptDriverOfferResult,
  DeclineDriverOfferResult,
  DriverAvailabilitySummary,
  DriverEligibilitySummary,
  DriverOfferSummary,
  SetDriverAvailabilityRequest
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; blockers?: string[] };
  if (!response.ok) {
    const blockers = body.blockers?.length ? `: ${body.blockers.join(', ')}` : '';
    throw new Error(`${body.code ?? 'REQUEST_FAILED'}${blockers}`);
  }
  return body;
}

export async function getDriverEligibility(sessionToken: string, vehicleId?: string): Promise<DriverEligibilitySummary> {
  const query = vehicleId ? `?vehicleId=${encodeURIComponent(vehicleId)}` : '';
  return json(await fetch(`${API_BASE_URL}/v1/driver/eligibility${query}`, {
    headers: { authorization: `Bearer ${sessionToken}` }
  }));
}

export async function setDriverAvailability(
  sessionToken: string,
  request: SetDriverAvailabilityRequest
): Promise<DriverAvailabilitySummary> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/availability`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${sessionToken}`,
      'content-type': 'application/json',
      'idempotency-key': requestKey('driver-availability')
    },
    body: JSON.stringify(request)
  }));
}

export async function listDriverOffers(sessionToken: string): Promise<readonly DriverOfferSummary[]> {
  const result = await json<{ offers: readonly DriverOfferSummary[] }>(await fetch(`${API_BASE_URL}/v1/driver/offers`, {
    headers: { authorization: `Bearer ${sessionToken}` }
  }));
  return result.offers;
}

export async function acceptDriverOffer(sessionToken: string, offerId: string): Promise<AcceptDriverOfferResult> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/offers/${offerId}/accept`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken}`,
      'idempotency-key': requestKey('accept-driver-offer')
    }
  }));
}

export async function declineDriverOffer(sessionToken: string, offerId: string): Promise<DeclineDriverOfferResult> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/offers/${offerId}/decline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken}`,
      'content-type': 'application/json',
      'idempotency-key': requestKey('decline-driver-offer')
    },
    body: JSON.stringify({ reasonCode: 'NOT_SUITABLE' })
  }));
}
