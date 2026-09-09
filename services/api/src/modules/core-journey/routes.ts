import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import { CoreJourneyNotFoundError, getCoreJourneyProgress } from './core-journey-service.js';

export function registerCoreJourneyRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/bookings/:bookingId/core-journey-progress', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const principal = await authenticateBearerSession(pool, token, 'BOOK_RIDE');
    if (!principal?.riderProfileId) return reply.code(403).send({ code: 'RIDER_SESSION_REQUIRED' });
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await getCoreJourneyProgress(pool, params.data.bookingId, principal));
    } catch (error) {
      if (error instanceof CoreJourneyNotFoundError) return reply.code(404).send({ code: 'CORE_JOURNEY_NOT_FOUND' });
      request.log.error({ err: error }, 'core Journey progress read failed');
      return reply.code(500).send({ code: 'CORE_JOURNEY_PROGRESS_UNAVAILABLE' });
    }
  });
}
