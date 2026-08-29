import type { DriverEarningsProjection } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

export async function readDriverEarnings(sessionToken: string): Promise<DriverEarningsProjection> {
  const response = await fetch(`${API_BASE_URL}/v1/driver/earnings`, {
    headers: { authorization: `Bearer ${sessionToken}` }
  });
  const body = await response.json() as DriverEarningsProjection & { code?: string };
  if (!response.ok) throw new Error(body.code ?? 'DRIVER_EARNINGS_UNAVAILABLE');
  return body;
}
