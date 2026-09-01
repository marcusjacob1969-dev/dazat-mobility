import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  getCommunicationsClosureCapabilities,
  getCommunicationsLaunchReadiness,
  getRecipientCommunicationsClosureStatus
} from './communications-closure-service.js';

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, 'VIEW_PROFILE');
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_COMMUNICATIONS_CLOSURE_UNAVAILABLE' }); return null; }
  return principal;
}

export function registerCommunicationsClosureRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/communications/closure/capabilities', async (_request, reply) => {
    return reply.code(200).send(getCommunicationsClosureCapabilities());
  });

  app.get('/v1/communications/closure/status', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await getRecipientCommunicationsClosureStatus(pool, principal));
    } catch (error) {
      request.log.error({ err: error }, 'Recipient communications closure status read failed');
      return reply.code(500).send({ code: 'COMMUNICATIONS_CLOSURE_STATUS_UNAVAILABLE' });
    }
  });

  app.get('/v1/communications/closure/readiness', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await getCommunicationsLaunchReadiness(pool));
    } catch (error) {
      request.log.error({ err: error }, 'Communications launch readiness read failed');
      return reply.code(500).send({ code: 'COMMUNICATIONS_LAUNCH_READINESS_UNAVAILABLE' });
    }
  });
}
