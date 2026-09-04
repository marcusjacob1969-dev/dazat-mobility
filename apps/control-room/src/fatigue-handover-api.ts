export interface RecoverableFatigueHandoverItem {
  controlledHandoverId: string;
  status: 'OWNED' | 'REPLACEMENT_ASSIGNED' | 'PASSENGER_TRANSFERRED' | 'SAFE_STOP_CONFIRMED';
  version: number;
  previousTaskScopeId: string;
  previousTaskExpiredAt: string;
  supportCaseStatus: 'IN_PROGRESS';
  operationalHoldStatus: 'ACTIVE';
  recoveryEligibleAtRead: true;
  passengerContinuityRequired: true;
}

export interface RecoverableFatigueHandoverQueue {
  items: RecoverableFatigueHandoverItem[];
  limit: number;
  returnedCount: number;
  commandRevalidationRequired: true;
}

export interface RecoveredFatigueHandoverOwnership {
  controlledHandoverId: string;
  previousTaskScopeId: string;
  taskScopeId: string;
  status: RecoverableFatigueHandoverItem['status'];
  version: number;
  operationalHoldStatus: 'ACTIVE';
  supportCaseStatus: 'IN_PROGRESS';
  passengerContinuityRequired: true;
  outcomeClaimed: false;
  externalServiceContacted: false;
  recoveredAt: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`CONTROL_ROOM_REQUEST_FAILED_${response.status}`);
  return response.json() as Promise<T>;
}

export async function getRecoverableFatigueHandovers(
  apiBaseUrl: string,
  bearerToken: string,
  limit = 25,
  signal?: AbortSignal
): Promise<RecoverableFatigueHandoverQueue> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await fetch(`${apiBaseUrl}/v1/control-room/fatigue-handovers/recoverable?limit=${safeLimit}`, {
    method: 'GET', headers: { authorization: `Bearer ${bearerToken}` }, cache: 'no-store',
    ...(signal ? { signal } : {})
  });
  return parseResponse(response);
}

export async function recoverFatigueHandoverOwnership(
  apiBaseUrl: string,
  bearerToken: string,
  controlledHandoverId: string,
  recoveryEvidenceReference: string,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<RecoveredFatigueHandoverOwnership> {
  const response = await fetch(`${apiBaseUrl}/v1/control-room/fatigue-handovers/${encodeURIComponent(controlledHandoverId)}/recover-ownership`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bearerToken}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify({ recoveryEvidenceReference }),
    cache: 'no-store', ...(signal ? { signal } : {})
  });
  return parseResponse(response);
}
