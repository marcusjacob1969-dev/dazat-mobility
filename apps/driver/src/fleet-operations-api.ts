import type { FleetAgreementProjection, FleetMarketplaceOfferProjection, VehicleAssignmentValidationProjection } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string };
  if (!response.ok) throw new Error(body.code ?? 'FLEET_OPERATIONS_REQUEST_FAILED');
  return body;
}
function auth(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

export async function listFleetMarketplace(
  sessionToken: string,
  regionCode: string
): Promise<readonly FleetMarketplaceOfferProjection[]> {
  const query = new URLSearchParams({ regionCode });
  const result = await json<{ offers: readonly FleetMarketplaceOfferProjection[] }>(
    await fetch(`${API_BASE_URL}/v1/fleet/marketplace?${query}`, { headers: auth(sessionToken) })
  );
  return result.offers;
}

export async function listDriverFleetAgreements(
  sessionToken: string
): Promise<readonly FleetAgreementProjection[]> {
  const result = await json<{ agreements: readonly FleetAgreementProjection[] }>(
    await fetch(`${API_BASE_URL}/v1/driver/fleet-agreements`, { headers: auth(sessionToken) })
  );
  return result.agreements;
}

export async function validateVehicleAssignment(
  sessionToken: string,
  regionCode: string,
  vehicleId: string,
  replacementForAssignmentId?: string
): Promise<VehicleAssignmentValidationProjection> {
  const query = new URLSearchParams({ regionCode, vehicleId, ...(replacementForAssignmentId ? { replacementForAssignmentId } : {}) });
  return json(await fetch(`${API_BASE_URL}/v1/driver/vehicle-assignment-validation?${query}`, { headers: auth(sessionToken) }));
}
