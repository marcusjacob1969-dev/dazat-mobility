import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ApiConfig } from '../../config.js';
import type { DatabasePool } from '../../db.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  acknowledgeDriverAssignment,
  getJourneyLiveProjection,
  getJourneyLiveProjectionByBooking,
  JourneyConflictError,
  JourneyEvidenceError,
  JourneyForbiddenError,
  JourneyNotFoundError,
  markDriverArrived,
  recordDriverLocationObservation,
  startJourney,
  startRideCheck,
  verifyRideCheck
} from './journey-service.js';

const journeyParams = z.object({ journeyId: z.string().uuid() });
const bookingParams = z.object({ bookingId: z.string().uuid() });
const locationSchema = z.object({
  clientObservationId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  observedAt: z.string().datetime({ offset: true }),
  source: z.enum(['DEVICE_GPS', 'FLEET_TELEMATICS']),
  accuracyMetres: z.number().finite().min(0).max(100_000),
  confidence: z.number().finite().min(0).max(1)
}).strict();
const verifySchema = z.object({
  rideCheckSessionId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/)
}).strict();

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

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

function sendJourneyError(reply: FastifyReply, error: unknown) {
  if (error instanceof JourneyNotFoundError) return reply.code(404).send({ code: 'JOURNEY_RESOURCE_NOT_FOUND' });
  if (error instanceof JourneyForbiddenError) return reply.code(403).send({ code: 'JOURNEY_FORBIDDEN' });
  if (error instanceof JourneyEvidenceError) return reply.code(409).send({ code: 'JOURNEY_EVIDENCE_REJECTED', blockers: error.blockers });
  if (error instanceof JourneyConflictError) return reply.code(409).send({ code: 'JOURNEY_STATE_CONFLICT', message: error.message });
  return null;
}

export function registerJourneyRoutes(app: FastifyInstance, pool: DatabasePool, config: ApiConfig): void {
  app.get('/v1/bookings/:bookingId/journey', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = bookingParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await getJourneyLiveProjectionByBooking(pool, params.data.bookingId, principal, config));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'Booking Journey projection failed');
      return reply.code(500).send({ code: 'JOURNEY_PROJECTION_UNAVAILABLE' });
    }
  });

  app.post('/v1/bookings/:bookingId/journey/acknowledge', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = bookingParams.safeParse(request.params);
    const key = idempotencyKey(request);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await acknowledgeDriverAssignment(pool, params.data.bookingId, principal, key));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'assignment acknowledgement failed');
      return reply.code(500).send({ code: 'JOURNEY_ACKNOWLEDGEMENT_UNAVAILABLE' });
    }
  });

  app.post('/v1/journeys/:journeyId/location-observations', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = journeyParams.safeParse(request.params);
    const body = locationSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_LOCATION_OBSERVATION' });
    try {
      return reply.code(202).send(await recordDriverLocationObservation(pool, params.data.journeyId, body.data, principal, config));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'journey location observation failed');
      return reply.code(500).send({ code: 'JOURNEY_LOCATION_UNAVAILABLE' });
    }
  });

  app.post('/v1/journeys/:journeyId/arrived', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = journeyParams.safeParse(request.params);
    const key = idempotencyKey(request);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_JOURNEY_ID' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await markDriverArrived(pool, params.data.journeyId, principal, key, config));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'journey arrival failed');
      return reply.code(500).send({ code: 'JOURNEY_ARRIVAL_UNAVAILABLE' });
    }
  });

  app.post('/v1/journeys/:journeyId/ridecheck/start', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = journeyParams.safeParse(request.params);
    const key = idempotencyKey(request);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_JOURNEY_ID' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(201).send(await startRideCheck(pool, params.data.journeyId, principal, key, config));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'RideCheck start failed');
      return reply.code(500).send({ code: 'RIDECHECK_START_UNAVAILABLE' });
    }
  });

  app.post('/v1/journeys/:journeyId/ridecheck/verify', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = journeyParams.safeParse(request.params);
    const body = verifySchema.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_RIDECHECK_VERIFICATION' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const result = await verifyRideCheck(pool, params.data.journeyId, body.data.rideCheckSessionId, body.data.code, principal, key, config);
      return reply.code(result.verified ? 200 : 409).send(result);
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'RideCheck verification failed');
      return reply.code(500).send({ code: 'RIDECHECK_VERIFICATION_UNAVAILABLE' });
    }
  });

  app.post('/v1/journeys/:journeyId/start', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = journeyParams.safeParse(request.params);
    const key = idempotencyKey(request);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_JOURNEY_ID' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await startJourney(pool, params.data.journeyId, principal, key, config));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'protected Journey start failed');
      return reply.code(500).send({ code: 'JOURNEY_START_UNAVAILABLE' });
    }
  });

  app.get('/v1/journeys/:journeyId/live', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = journeyParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_JOURNEY_ID' });
    try {
      return reply.code(200).send(await getJourneyLiveProjection(pool, params.data.journeyId, principal, config));
    } catch (error) {
      const known = sendJourneyError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'Journey live projection failed');
      return reply.code(500).send({ code: 'JOURNEY_PROJECTION_UNAVAILABLE' });
    }
  });
}
