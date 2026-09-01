import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AccountCapability } from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  FinanceConflictError,
  FinanceForbiddenError,
  FinanceIdempotencyConflictError,
  FinanceNotFoundError,
  getDriverEarnings,
  getPaymentStatus,
  getReceiptByBooking,
  preparePaymentIntent,
  ReceiptNotReadyError
} from './finance-service.js';

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

async function requireFinancialPrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  pool: DatabasePool,
  capability: AccountCapability = 'VIEW_FINANCIAL_HISTORY'
) {
  const token = bearer(request);
  if (!token) {
    await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  const principal = await authenticateBearerSession(pool, token, capability);
  if (!principal) {
    await reply.code(401).send({ code: 'SESSION_INVALID_OR_FINANCIAL_HISTORY_UNAVAILABLE' });
    return null;
  }
  return principal;
}

function sendFinanceError(reply: FastifyReply, error: unknown) {
  if (error instanceof FinanceNotFoundError) return reply.code(404).send({ code: 'FINANCE_RESOURCE_NOT_FOUND' });
  if (error instanceof FinanceForbiddenError) return reply.code(403).send({ code: 'FINANCE_FORBIDDEN' });
  if (error instanceof FinanceIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof ReceiptNotReadyError) return reply.code(409).send({ code: 'RECEIPT_NOT_READY', message: error.message });
  if (error instanceof FinanceConflictError) return reply.code(409).send({ code: 'FINANCE_STATE_CONFLICT', message: error.message });
  return null;
}

export function registerFinanceRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.post('/v1/bookings/:bookingId/payment-intents', async (request, reply) => {
    const principal = await requireFinancialPrincipal(request, reply, pool, 'PREPARE_PAYMENT');
    if (!principal) return;
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(201).send(await preparePaymentIntent(pool, params.data.bookingId, principal, key));
    } catch (error) {
      const known = sendFinanceError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'provider-disabled PaymentIntent preparation failed');
      return reply.code(500).send({ code: 'PAYMENT_INTENT_UNAVAILABLE' });
    }
  });

  app.get('/v1/payments/:paymentId/status', async (request, reply) => {
    const principal = await requireFinancialPrincipal(request, reply, pool);
    if (!principal) return;
    const params = z.object({ paymentId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_PAYMENT_ID' });
    try {
      return reply.code(200).send(await getPaymentStatus(pool, params.data.paymentId, principal));
    } catch (error) {
      const known = sendFinanceError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'Payment status read failed');
      return reply.code(500).send({ code: 'PAYMENT_STATUS_UNAVAILABLE' });
    }
  });

  app.get('/v1/receipts/:bookingId', async (request, reply) => {
    const principal = await requireFinancialPrincipal(request, reply, pool);
    if (!principal) return;
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await getReceiptByBooking(pool, params.data.bookingId, principal));
    } catch (error) {
      const known = sendFinanceError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'Receipt read failed');
      return reply.code(500).send({ code: 'RECEIPT_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/earnings', async (request, reply) => {
    const principal = await requireFinancialPrincipal(request, reply, pool);
    if (!principal) return;
    try {
      return reply.code(200).send(await getDriverEarnings(pool, principal));
    } catch (error) {
      const known = sendFinanceError(reply, error);
      if (known) return known;
      request.log.error({ err: error }, 'Driver earnings read failed');
      return reply.code(500).send({ code: 'DRIVER_EARNINGS_UNAVAILABLE' });
    }
  });
}
