import type {
  AcknowledgeCommunicationRequest,
  CommunicationAcknowledgementProjection,
  CommunicationInboxProjection,
  CommunicationProjection
} from '@dazat/contracts';

const API_BASE = process.env.EXPO_PUBLIC_DAZAT_API_BASE_URL ?? 'http://localhost:3001';

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string };
  if (!response.ok) throw new Error(body.code ?? `Communication request failed (${response.status})`);
  return body;
}

export async function readCommunicationInbox(sessionToken: string): Promise<CommunicationInboxProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}

export async function readCommunication(sessionToken: string, communicationId: string): Promise<CommunicationProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/${communicationId}`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}

export async function acknowledgeCommunication(
  sessionToken: string,
  communicationId: string,
  request: AcknowledgeCommunicationRequest,
  idempotencyKey: string
): Promise<CommunicationAcknowledgementProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/${communicationId}/acknowledgements`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(request)
  }));
}
