import type {
  ActorOrganisationContextProjection,
  ActorOrganisationSummaryProjection,
  InstitutionalTransportCapabilitiesProjection,
  InstitutionalTransportContextProjection,
  OrganisationOperationsCapabilitiesProjection
} from '@dazat/contracts';

async function readJson<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(path, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`Organisation read failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function readOrganisationCapabilities(): Promise<OrganisationOperationsCapabilitiesProjection> {
  return readJson('/v1/organisations/capabilities');
}

export async function readActorOrganisations(token: string): Promise<readonly ActorOrganisationSummaryProjection[]> {
  const result = await readJson<{ organisations: readonly ActorOrganisationSummaryProjection[] }>('/v1/organisations', token);
  return result.organisations;
}

export function readActorOrganisationContext(
  token: string,
  organisationId: string
): Promise<ActorOrganisationContextProjection> {
  return readJson(`/v1/organisations/${encodeURIComponent(organisationId)}/context`, token);
}

export function readInstitutionalTransportCapabilities(): Promise<InstitutionalTransportCapabilitiesProjection> {
  return readJson('/v1/institutional-transport/capabilities');
}

export function readInstitutionalTransportContext(
  token: string,
  organisationId: string
): Promise<InstitutionalTransportContextProjection> {
  return readJson(`/v1/organisations/${encodeURIComponent(organisationId)}/institutional-transport`, token);
}
