import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  JourneyConflictError,
  JourneyForbiddenError,
  JourneyNotFoundError
} from '../journey/journey-service.js';
import { createSafetySignal } from './safety-service.js';

const journeySignalSchema = z.object({ journeyId: z.string().uuid() }).strict();
const routeConcernSchema = journeySignalSchema.extend({
  routeConcernCategory: z.enum(['CHECK_ROUTE', 'WRONG_DESTINATION', 'FEEL_UNSAFE', 'UNEXPECTED_STOP', 'OTHER'])
}).strict();

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) {
    await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  const principal = await authenticateBearerSession(pool, token, 'ACTIVE_JOURNEY');
  if (!principal) {
    await reply.code(401).send({ code: 'SESSION_INVALID_OR_JOURNEY_CAPABILITY_BLOCKED' });
    return null;
  }
  return principal;
}

function sendSafetyError(reply: FastifyReply, error: unknown) {
  if (error instanceof JourneyNotFoundError) return reply.code(404).send({ code: 'JOURNEY_RESOURCE_NOT_FOUND' });
  if (error instanceof JourneyForbiddenError) return reply.code(403).send({ code: 'SAFETY_SIGNAL_FORBIDDEN' });
  if (error instanceof JourneyConflictError) return reply.code(409).send({ code: 'SAFETY_SIGNAL_CONFLICT', message: error.message });
  return null;
}

export function registerSafetyRoutes(app: FastifyInstance, pool: DatabasePool): void {
  const registerSignal = (path: string, signalType: 'SOS' | 'SILENT_ASSISTANCE') => {
    app.post(path, async (request, reply) => {
      const principal = await requirePrincipal(request, reply, pool);
      if (!principal) return;
      const body = journeySignalSchema.safeParse(request.body);
      const key = idempotencyKey(request);
      if (!body.success) return reply.code(400).send({ code: 'INVALID_SAFETY_SIGNAL' });
      if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
      try {
        return reply.code(201).send(await createSafetySignal(pool, {
          journeyId: body.data.journeyId,
          signalType
        }, principal, key));
      } catch (error) {
        const known = sendSafetyError(reply, error);
        if (known) return known;
        request.log.error({ err: error }, 'Safety signal persistence failed');
        return reply.code(500).send({ code: 'SAFETY_SIGNAL_PERSISTENCE_UNAVAILABLE' });
      }
    });
  };

  registerSignal('/v1/safety/signals/sos', 'SOS');
  registerSignal('/v1/safety/signals/silent-assistance', 'SILENT_ASSISTANCE');

  app.post('/v1/safety/route-concerns', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const body = routeConcernSchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_ROUTE_CONCERN' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(201).send(await createSafetySignal(pool, {
        journeyId: body.data.journeyId,
        signalType: 'ROUTE_CONCERN',
        routeConcernCategory: body.data.routeConcernCategory
      }, principal, key));
    } catch (error) {
      const known = sendSafetyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'route concern persistence failed');
      return reply.code(500).send({ code: 'ROUTE_CONCERN_PERSISTENCE_UNAVAILABLE' });
    }
  });
}
