import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  getCommunicationsOperationsCapabilities,
  getRecipientCommunicationsOperationsStatus,
  listRecipientContactCases
} from './communications-operations-service.js';

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, 'VIEW_PROFILE');
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_COMMUNICATIONS_OPERATIONS_UNAVAILABLE' }); return null; }
  return principal;
}

export function registerCommunicationsOperationsRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/communications/operations/capabilities', async (_request, reply) => {
    return reply.code(200).send(getCommunicationsOperationsCapabilities());
  });

  app.get('/v1/contact-centre/cases', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await listRecipientContactCases(pool, principal));
    } catch (error) {
      request.log.error({ err: error }, 'Recipient Contact Centre cases read failed');
      return reply.code(500).send({ code: 'CONTACT_CASES_UNAVAILABLE' });
    }
  });

  app.get('/v1/communications/operations/status', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await getRecipientCommunicationsOperationsStatus(pool, principal));
    } catch (error) {
      request.log.error({ err: error }, 'Communications operations status read failed');
      return reply.code(500).send({ code: 'COMMUNICATIONS_OPERATIONS_STATUS_UNAVAILABLE' });
    }
  });
}
