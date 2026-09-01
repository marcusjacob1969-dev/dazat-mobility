import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  getContactPlan,
  getTelephonyServiceCapabilities,
  listTelephonyInteractions
} from './telephony-voice-service.js';

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, 'VIEW_PROFILE');
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_TELEPHONY_HISTORY_UNAVAILABLE' }); return null; }
  return principal;
}

export function registerTelephonyVoiceRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/telephony/capabilities', async (_request, reply) => {
    return reply.code(200).send(getTelephonyServiceCapabilities());
  });

  app.get('/v1/contact-plan', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await getContactPlan(pool, principal));
    } catch (error) {
      request.log.error({ err: error }, 'Contact plan read failed');
      return reply.code(500).send({ code: 'CONTACT_PLAN_UNAVAILABLE' });
    }
  });

  app.get('/v1/telephony/interactions', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await listTelephonyInteractions(pool, principal));
    } catch (error) {
      request.log.error({ err: error }, 'Telephony interaction history failed');
      return reply.code(500).send({ code: 'TELEPHONY_INTERACTIONS_UNAVAILABLE' });
    }
  });
}
