import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  acknowledgeCommunication,
  CommunicationConflictError,
  CommunicationForbiddenError,
  CommunicationIdempotencyConflictError,
  CommunicationNotFoundError,
  getCommunication,
  listCommunications
} from './communications-service.js';

const acknowledgementSchema = z.object({
  clientAcknowledgementId: z.string().uuid(),
  acknowledgedAt: z.string().datetime({ offset: true })
}).strict();

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, 'VIEW_PROFILE');
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_COMMUNICATIONS_UNAVAILABLE' }); return null; }
  return principal;
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof CommunicationNotFoundError) return reply.code(404).send({ code: 'COMMUNICATION_NOT_FOUND' });
  if (error instanceof CommunicationForbiddenError) return reply.code(403).send({ code: 'COMMUNICATION_FORBIDDEN' });
  if (error instanceof CommunicationIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof CommunicationConflictError) return reply.code(409).send({ code: 'COMMUNICATION_STATE_CONFLICT', message: error.message });
  return null;
}

export function registerCommunicationRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/communications', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await listCommunications(pool, principal));
    } catch (error) {
      request.log.error({ err: error }, 'Communication inbox failed');
      return reply.code(500).send({ code: 'COMMUNICATION_INBOX_UNAVAILABLE' });
    }
  });

  app.get('/v1/communications/:communicationId', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = z.object({ communicationId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_COMMUNICATION_ID' });
    try {
      return reply.code(200).send(await getCommunication(pool, principal, params.data.communicationId));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Communication read failed');
      return reply.code(500).send({ code: 'COMMUNICATION_UNAVAILABLE' });
    }
  });

  app.post('/v1/communications/:communicationId/acknowledgements', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = z.object({ communicationId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_COMMUNICATION_ID' });
    const body = acknowledgementSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_COMMUNICATION_ACKNOWLEDGEMENT' });
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await acknowledgeCommunication(pool, principal, params.data.communicationId, body.data, key));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Communication acknowledgement failed');
      return reply.code(500).send({ code: 'COMMUNICATION_ACKNOWLEDGEMENT_UNAVAILABLE' });
    }
  });
}
