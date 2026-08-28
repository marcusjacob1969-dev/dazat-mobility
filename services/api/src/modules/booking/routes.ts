import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import {
  BookingConflictError,
  BookingForbiddenError,
  BookingNotFoundError,
  QuoteNotUsableError,
  confirmRiderBooking,
  createRiderBooking,
  getRiderBooking,
  quoteRiderBooking
} from './booking-service.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import type { PricingPort } from './development-pricing-adapter.js';
import { PricingNotConfiguredError } from './development-pricing-adapter.js';

const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  displayLabel: z.string().trim().min(1).max(500),
  structuredAddress: z.record(z.string(), z.string()).optional(),
  providerReference: z.string().trim().min(1).max(500).optional()
}).strict();

const createBookingSchema = z.object({
  regionCode: z.string().trim().min(2).max(32),
  pickup: locationSchema,
  dropoff: locationSchema,
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  requirements: z.array(z.object({
    type: z.string().trim().min(1).max(100),
    value: z.record(z.string(), z.unknown())
  }).strict()).max(50).optional()
}).strict();

const confirmBookingSchema = z.object({ quoteId: z.string().uuid() }).strict();

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

async function requireRider(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) {
    await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  const principal = await authenticateBearerSession(pool, token, 'BOOK_RIDE');
  if (!principal) {
    await reply.code(401).send({ code: 'SESSION_OR_BOOKING_CAPABILITY_UNAVAILABLE' });
    return null;
  }
  if (!principal.riderProfileId) {
    await reply.code(403).send({ code: 'RIDER_PROFILE_REQUIRED' });
    return null;
  }
  return principal;
}

function sendBookingError(reply: FastifyReply, error: unknown) {
  if (error instanceof BookingNotFoundError) return reply.code(404).send({ code: 'BOOKING_NOT_FOUND' });
  if (error instanceof BookingForbiddenError) return reply.code(403).send({ code: 'BOOKING_FORBIDDEN' });
  if (error instanceof BookingConflictError) return reply.code(409).send({ code: 'BOOKING_STATE_CONFLICT', message: error.message });
  if (error instanceof QuoteNotUsableError) return reply.code(409).send({ code: 'QUOTE_NOT_USABLE' });
  if (error instanceof PricingNotConfiguredError) return reply.code(503).send({ code: 'PRICING_CONFIGURATION_REQUIRED' });
  return null;
}

export function registerBookingRoutes(app: FastifyInstance, pool: DatabasePool, pricing: PricingPort): void {
  app.post('/v1/bookings', async (request, reply) => {
    const principal = await requireRider(request, reply, pool);
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const parsed = createBookingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_BOOKING_REQUEST' });
    try {
      const result = await createRiderBooking(pool, parsed.data, principal, key);
      return reply.code(201).send(result);
    } catch (error) {
      const known = sendBookingError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'booking creation failed');
      return reply.code(500).send({ code: 'BOOKING_CREATION_UNAVAILABLE' });
    }
  });

  app.get('/v1/bookings/:bookingId', async (request, reply) => {
    const principal = await requireRider(request, reply, pool);
    if (!principal) return;
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await getRiderBooking(pool, params.data.bookingId, principal));
    } catch (error) {
      const known = sendBookingError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'booking read failed');
      return reply.code(500).send({ code: 'BOOKING_READ_UNAVAILABLE' });
    }
  });

  app.post('/v1/bookings/:bookingId/quote', async (request, reply) => {
    const principal = await requireRider(request, reply, pool);
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(201).send(await quoteRiderBooking(pool, params.data.bookingId, principal, pricing, key));
    } catch (error) {
      const known = sendBookingError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'booking quote failed');
      return reply.code(500).send({ code: 'BOOKING_QUOTE_UNAVAILABLE' });
    }
  });

  app.post('/v1/bookings/:bookingId/confirm', async (request, reply) => {
    const principal = await requireRider(request, reply, pool);
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    const body = confirmBookingSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_BOOKING_CONFIRMATION' });
    try {
      return reply.code(200).send(await confirmRiderBooking(pool, params.data.bookingId, body.data.quoteId, principal, key));
    } catch (error) {
      const known = sendBookingError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'booking confirmation failed');
      return reply.code(500).send({ code: 'BOOKING_CONFIRMATION_UNAVAILABLE' });
    }
  });
}
