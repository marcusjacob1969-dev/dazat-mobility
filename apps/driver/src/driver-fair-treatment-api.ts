import type {
  DriverAppealSubjectType,
  DriverFairTreatmentProjection,
  DriverIncentiveProjection,
  RiderConductCaseProjection,
  SubmitDriverAppealProjection,
  SubmitDriverAppealRequest,
  SubmitRiderConductReportRequest,
  UnsafeJourneyTerminationProjection
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${body.code ?? 'FAIR_TREATMENT_REQUEST_FAILED'}${body.message ? `: ${body.message}` : ''}`);
  return body;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function readDriverFairTreatment(sessionToken: string): Promise<DriverFairTreatmentProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/fair-treatment`, { headers: auth(sessionToken) }));
}

export async function submitRiderConductCase(
  sessionToken: string,
  request: SubmitRiderConductReportRequest
): Promise<RiderConductCaseProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/rider-conduct-cases`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('rider-conduct') },
    body: JSON.stringify(request)
  }));
}

export async function terminateUnsafeJourney(
  sessionToken: string,
  journeyId: string,
  request: Omit<SubmitRiderConductReportRequest, 'journeyId'>
): Promise<UnsafeJourneyTerminationProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/journeys/${journeyId}/unsafe-termination`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('unsafe-termination') },
    body: JSON.stringify(request)
  }));
}

export async function submitAppeal(
  sessionToken: string,
  request: SubmitDriverAppealRequest
): Promise<SubmitDriverAppealProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/appeals`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('driver-appeal') },
    body: JSON.stringify(request)
  }));
}

export async function listDriverIncentives(
  sessionToken: string,
  regionCode: string
): Promise<readonly DriverIncentiveProjection[]> {
  const query = new URLSearchParams({ regionCode });
  const result = await json<{ incentives: readonly DriverIncentiveProjection[] }>(
    await fetch(`${API_BASE_URL}/v1/driver/incentives?${query}`, { headers: auth(sessionToken) })
  );
  return result.incentives;
}

export const driverAppealSubjectTypes: readonly DriverAppealSubjectType[] = [
  'COMPLAINT_FINDING', 'DRIVER_RESTRICTION', 'OFFBOARDING_DECISION', 'INCENTIVE_QUALIFICATION'
];
