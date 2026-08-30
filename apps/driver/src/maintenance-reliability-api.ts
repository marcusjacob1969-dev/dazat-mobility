import type {
  PreShiftCheckProjection,
  SubmitPreShiftCheckRequest,
  VehicleMaintenanceProjection,
  VerifiedDriverPerkProjection
} from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string; message?: string };
  if (!response.ok) throw new Error(`${body.code ?? 'MAINTENANCE_REQUEST_FAILED'}${body.message ? `: ${body.message}` : ''}`);
  return body;
}

function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function readVehicleMaintenance(
  sessionToken: string,
  vehicleId: string,
  serviceCodes: readonly string[]
): Promise<VehicleMaintenanceProjection> {
  const query = new URLSearchParams({ serviceCodes: serviceCodes.join(',') });
  return json(await fetch(`${API_BASE_URL}/v1/driver/vehicles/${vehicleId}/maintenance?${query}`, {
    headers: auth(sessionToken)
  }));
}

export async function submitPreShiftCheck(
  sessionToken: string,
  vehicleId: string,
  request: SubmitPreShiftCheckRequest
): Promise<PreShiftCheckProjection> {
  return json(await fetch(`${API_BASE_URL}/v1/driver/vehicles/${vehicleId}/pre-shift-checks`, {
    method: 'POST',
    headers: {
      ...auth(sessionToken),
      'content-type': 'application/json',
      'idempotency-key': requestKey('pre-shift-check')
    },
    body: JSON.stringify(request)
  }));
}

export async function listVerifiedDriverPerks(
  sessionToken: string,
  regionCode: string
): Promise<readonly VerifiedDriverPerkProjection[]> {
  const query = new URLSearchParams({ regionCode });
  const result = await json<{ perks: readonly VerifiedDriverPerkProjection[] }>(
    await fetch(`${API_BASE_URL}/v1/driver/perks?${query}`, { headers: auth(sessionToken) })
  );
  return result.perks;
}
