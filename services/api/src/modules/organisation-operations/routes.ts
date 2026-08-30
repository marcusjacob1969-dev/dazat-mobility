import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabasePool } from '../../db.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  getActorOrganisationContext,
  getOrganisationOperationsCapabilities,
  listActorOrganisations
} from './organisation-operations-service.js';

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, 'VIEW_PROFILE');
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_ORGANISATION_ACCESS_UNAVAILABLE' }); return null; }
  return principal;
}

export function registerOrganisationOperationsRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/organisations/capabilities', async (_request, reply) => {
    return reply.code(200).send(getOrganisationOperationsCapabilities());
  });

  app.get('/v1/organisations', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send({ organisations: await listActorOrganisations(pool, principal) });
    } catch (error) {
      request.log.error({ err: error }, 'Actor organisation list read failed');
      return reply.code(500).send({ code: 'ORGANISATION_LIST_UNAVAILABLE' });
    }
  });

  app.get<{ Params: { organisationId: string } }>('/v1/organisations/:organisationId/context', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.organisationId)) {
      return reply.code(400).send({ code: 'INVALID_ORGANISATION_ID' });
    }
    try {
      const context = await getActorOrganisationContext(pool, principal, request.params.organisationId);
      if (!context) return reply.code(404).send({ code: 'ORGANISATION_CONTEXT_NOT_FOUND' });
      return reply.code(200).send(context);
    } catch (error) {
      request.log.error({ err: error }, 'Actor organisation context read failed');
      return reply.code(500).send({ code: 'ORGANISATION_CONTEXT_UNAVAILABLE' });
    }
  });
}
