import type { DriverApplicationProjection, DriverOperatingEligibilityProjection } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${body.code ?? 'DRIVER_OPERATIONS_REQUEST_FAILED'}${body.message ? `: ${body.message}` : ''}`);
  return body;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function startOrResumeDriverApplication(sessionToken: string): Promise<DriverApplicationProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/applications`, {
    method: 'POST', headers: { ...auth(sessionToken), 'idempotency-key': requestKey('driver-application') }
  }));
}

export async function readDriverOperatingEligibility(
  sessionToken: string,
  regionCode: string,
  vehicleId?: string
): Promise<DriverOperatingEligibilityProjection> {
  const query = new URLSearchParams({ regionCode, ...(vehicleId ? { vehicleId } : {}) });
  return json(await fetch(`${API_BASE_URL}/v1/driver/operating-eligibility?${query}`, { headers: auth(sessionToken) }));
}
