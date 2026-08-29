import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import type { ApiConfig } from '../../config.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  acceptDriverOffer,
  declineDriverOffer,
  DispatchConflictError,
  DispatchForbiddenError,
  DispatchNotFoundError,
  DriverNotEligibleError,
  getBookingDispatchProjection,
  getDriverEligibility,
  listDriverOffers,
  setDriverAvailability,
  startBookingDispatch
} from './dispatch-service.js';

const availabilitySchema = z.object({
  status: z.enum(['AVAILABLE', 'OFFLINE', 'BREAK', 'FINISHING_SOON']),
  regionCode: z.string().trim().min(2).max(32).optional(),
  vehicleId: z.string().uuid().optional(),
  location: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    observedAt: z.string().datetime({ offset: true }),
    source: z.enum(['DEVICE_GPS', 'FLEET_TELEMATICS']),
    confidence: z.number().min(0).max(1)
  }).strict().optional()
}).strict();

const declineOfferSchema = z.object({
  reasonCode: z.enum(['NOT_SUITABLE', 'TAKING_BREAK', 'FINISHING_SOON', 'OTHER'])
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
  const principal = await authenticateBearerSession(pool, token);
  if (!principal) {
    await reply.code(401).send({ code: 'SESSION_INVALID' });
    return null;
  }
  return principal;
}

function sendDispatchError(reply: FastifyReply, error: unknown) {
  if (error instanceof DispatchNotFoundError) return reply.code(404).send({ code: 'DISPATCH_RESOURCE_NOT_FOUND' });
  if (error instanceof DispatchForbiddenError) return reply.code(403).send({ code: 'DISPATCH_FORBIDDEN' });
  if (error instanceof DriverNotEligibleError) return reply.code(409).send({ code: 'DRIVER_NOT_ELIGIBLE', blockers: error.blockers });
  if (error instanceof DispatchConflictError) return reply.code(409).send({ code: 'DISPATCH_STATE_CONFLICT', message: error.message });
  return null;
}

export function registerDispatchRoutes(app: FastifyInstance, pool: DatabasePool, config: ApiConfig): void {
  app.get('/v1/driver/eligibility', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!principal.driverProfileId) return reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' });
    const query = z.object({
      regionCode: z.string().trim().min(2).max(32),
      vehicleId: z.string().uuid().optional()
    }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_VEHICLE_ID' });
    try {
      return reply.code(200).send(await getDriverEligibility(
        pool, principal, query.data.vehicleId ?? null, query.data.regionCode.toUpperCase(), config
      ));
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'driver eligibility read failed');
      return reply.code(500).send({ code: 'DRIVER_ELIGIBILITY_UNAVAILABLE' });
    }
  });

  app.put('/v1/driver/availability', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!principal.driverProfileId) return reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' });
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const parsed = availabilitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_AVAILABILITY_REQUEST' });
    try {
      return reply.code(200).send(await setDriverAvailability(pool, principal, parsed.data, key, config));
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'driver availability update failed');
      return reply.code(500).send({ code: 'DRIVER_AVAILABILITY_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/offers', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!principal.driverProfileId) return reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' });
    try {
      return reply.code(200).send({ offers: await listDriverOffers(pool, principal) });
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'driver offers read failed');
      return reply.code(500).send({ code: 'DRIVER_OFFERS_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/offers/:offerId/accept', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!principal.driverProfileId) return reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' });
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const params = z.object({ offerId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_OFFER_ID' });
    try {
      return reply.code(200).send(await acceptDriverOffer(pool, principal, params.data.offerId, key, config));
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'driver offer acceptance failed');
      return reply.code(500).send({ code: 'DRIVER_OFFER_ACCEPTANCE_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/offers/:offerId/decline', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!principal.driverProfileId) return reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' });
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const params = z.object({ offerId: z.string().uuid() }).safeParse(request.params);
    const body = declineOfferSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_OFFER_DECLINE' });
    try {
      return reply.code(200).send(await declineDriverOffer(pool, principal, params.data.offerId, body.data.reasonCode, key));
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'driver offer decline failed');
      return reply.code(500).send({ code: 'DRIVER_OFFER_DECLINE_UNAVAILABLE' });
    }
  });

  app.post('/v1/bookings/:bookingId/dispatch', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    if (!principal.riderProfileId) return reply.code(403).send({ code: 'RIDER_PROFILE_REQUIRED' });
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await startBookingDispatch(pool, params.data.bookingId, principal, key, config));
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'booking dispatch start failed');
      return reply.code(500).send({ code: 'BOOKING_DISPATCH_UNAVAILABLE' });
    }
  });

  app.get('/v1/bookings/:bookingId/dispatch', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await getBookingDispatchProjection(pool, params.data.bookingId, principal));
    } catch (error) {
      const known = sendDispatchError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'booking dispatch projection failed');
      return reply.code(500).send({ code: 'BOOKING_DISPATCH_PROJECTION_UNAVAILABLE' });
    }
  });
}
