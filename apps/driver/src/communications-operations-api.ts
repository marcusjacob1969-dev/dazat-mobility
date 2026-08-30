import type {
  CommunicationsClosureCapabilitiesProjection,
  CommunicationsClosureStatusProjection,
  CommunicationsLaunchReadinessProjection,
  CommunicationsOperationsCapabilitiesProjection,
  CommunicationsOperationsStatusProjection,
  ContactCaseListProjection
} from '@dazat/contracts';

const API_BASE = process.env.EXPO_PUBLIC_DAZAT_API_BASE_URL ?? 'http://localhost:3001';

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { code?: string };
  if (!response.ok) throw new Error(body.code ?? `Communications operations request failed (${response.status})`);
  return body;
}

export async function readCommunicationsOperationsCapabilities(): Promise<CommunicationsOperationsCapabilitiesProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/operations/capabilities`));
}

export async function readContactCases(sessionToken: string): Promise<ContactCaseListProjection> {
  return parse(await fetch(`${API_BASE}/v1/contact-centre/cases`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}

export async function readCommunicationsOperationsStatus(sessionToken: string): Promise<CommunicationsOperationsStatusProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/operations/status`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}

export async function readCommunicationsClosureCapabilities(): Promise<CommunicationsClosureCapabilitiesProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/closure/capabilities`));
}

export async function readCommunicationsClosureStatus(sessionToken: string): Promise<CommunicationsClosureStatusProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/closure/status`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}

export async function readCommunicationsLaunchReadiness(sessionToken: string): Promise<CommunicationsLaunchReadinessProjection> {
  return parse(await fetch(`${API_BASE}/v1/communications/closure/readiness`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  }));
}
