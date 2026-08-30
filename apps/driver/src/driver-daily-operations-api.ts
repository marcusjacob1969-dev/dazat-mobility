import type {
  ArrivalCommunicationPlanProjection,
  ConnectivityReconciliationProjection,
  ConnectivityReconciliationRequest,
  DriverDailyOperationsProjection,
  DriverSupplyProjection,
  DriverSupportCaseProjection,
  OpenDriverSupportCaseRequest
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${body.code ?? 'DRIVER_DAILY_OPERATIONS_REQUEST_FAILED'}${body.message ? `: ${body.message}` : ''}`);
  return body;
}

export async function readDriverDailyOperations(sessionToken: string): Promise<DriverDailyOperationsProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/daily-operations`, { headers: auth(sessionToken) }));
}

export async function reconcileConnectivity(
  sessionToken: string,
  request: ConnectivityReconciliationRequest
): Promise<ConnectivityReconciliationProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/connectivity/reconciliations`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('connectivity') },
    body: JSON.stringify(request)
  }));
}

export async function openSupportCase(
  sessionToken: string,
  request: OpenDriverSupportCaseRequest
): Promise<DriverSupportCaseProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/support-cases`, {
    method: 'POST',
    headers: { ...auth(sessionToken), 'content-type': 'application/json', 'idempotency-key': requestKey('driver-support') },
    body: JSON.stringify(request)
  }));
}

export async function listSupportCases(sessionToken: string): Promise<readonly DriverSupportCaseProjection[]> {
  const result = await json<{ cases: readonly DriverSupportCaseProjection[] }>(await fetch(
    `${API_BASE_URL}/v1/driver/support-cases`, { headers: auth(sessionToken) }
  ));
  return result.cases;
}

export async function readSupplyDemand(
  sessionToken: string,
  regionCode: string,
  capabilityCodes: readonly string[]
): Promise<DriverSupplyProjection> {
  const query = new URLSearchParams({ regionCode, ...(capabilityCodes.length ? { capabilityCodes: capabilityCodes.join(',') } : {}) });
  return json(await fetch(`${API_BASE_URL}/v1/driver/supply-demand?${query}`, { headers: auth(sessionToken) }));
}

export async function readArrivalPlan(sessionToken: string, bookingId: string): Promise<ArrivalCommunicationPlanProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/bookings/${bookingId}/arrival-plan`, { headers: auth(sessionToken) }));
}
