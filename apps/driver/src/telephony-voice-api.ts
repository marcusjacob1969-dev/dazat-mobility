import type {
  ContactPlanProjection,
  TelephonyInteractionListProjection,
  TelephonyServiceCapabilitiesProjection
} from '@dazat/contracts';

const API_BASE = process.env.EXPO_PUBLIC_DAZAT_API_BASE_URL ?? 'http://localhost:3001';

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string };
  if (!response.ok) throw new Error(body.code ?? `Telephony request failed (${response.status})`);
  return body;
}

export async function readTelephonyCapabilities(): Promise<TelephonyServiceCapabilitiesProjection> {
  return parse(await fetch(`${API_BASE}/v1/telephony/capabilities`));
}

export async function readContactPlan(sessionToken: string): Promise<ContactPlanProjection> {
  return parse(await fetch(`${API_BASE}/v1/contact-plan`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}

export async function readTelephonyInteractions(sessionToken: string): Promise<TelephonyInteractionListProjection> {
  return parse(await fetch(`${API_BASE}/v1/telephony/interactions`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}
