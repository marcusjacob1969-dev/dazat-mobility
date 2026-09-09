import type { CoreJourneyProgressProjection } from '@dazat/contracts';

const API_BASE_URL = process.env.EXPO_PUBLIC_DAZAT_API_URL ?? 'http://localhost:3001';

export async function readDriverCoreJourneyProgress(sessionToken: string, bookingId: string): Promise<CoreJourneyProgressProjection> {
  const response = await fetch(`${API_BASE_URL}/v1/driver/bookings/${bookingId}/core-journey-progress`, {
    headers: { authorization: `Bearer ${sessionToken}` }
  });
  const body = await response.json() as CoreJourneyProgressProjection & { code?: string };
  if (!response.ok) throw new Error(body.code ?? `CORE_JOURNEY_PROGRESS_FAILED_${response.status}`);
  return body;
}
