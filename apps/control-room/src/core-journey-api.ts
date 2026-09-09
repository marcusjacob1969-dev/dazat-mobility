import type { CoreJourneyProgressProjection } from '@dazat/contracts';

export async function readTaskScopedCoreJourneyProgress(
  apiBaseUrl: string,
  bearerToken: string,
  controlledHandoverId: string,
  bookingId: string,
  signal?: AbortSignal
): Promise<CoreJourneyProgressProjection> {
  const path = `/v1/control-room/fatigue-handovers/${encodeURIComponent(controlledHandoverId)}/bookings/${encodeURIComponent(bookingId)}/core-journey-progress`;
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${path}`, {
    headers: { authorization: `Bearer ${bearerToken}` }, cache: 'no-store', ...(signal ? { signal } : {})
  });
  const body = await response.json() as CoreJourneyProgressProjection & { code?: string };
  if (!response.ok) throw new Error(body.code ?? `CONTROL_ROOM_JOURNEY_PROGRESS_FAILED_${response.status}`);
  return body;
}
