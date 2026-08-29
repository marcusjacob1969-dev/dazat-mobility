import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AccountCapability } from '@dazat/domain';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  DriverOperationsConflictError,
  DriverOperationsForbiddenError,
  DriverOperationsIdempotencyConflictError,
  DriverOperationsNotFoundError,
  getCurrentDriverApplication,
  getDriverOperatingEligibilityProjection,
  startOrResumeDriverApplication
} from './driver-operations-service.js';

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

async function requireDriverPrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  pool: DatabasePool,
  capability: AccountCapability
) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, capability);
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_DRIVER_CAPABILITY_UNAVAILABLE' }); return null; }
  if (!principal.driverProfileId) { await reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' }); return null; }
  return principal;
}

function sendDriverOperationsError(reply: FastifyReply, error: unknown) {
  if (error instanceof DriverOperationsNotFoundError) return reply.code(404).send({ code: 'DRIVER_OPERATIONS_RESOURCE_NOT_FOUND' });
  if (error instanceof DriverOperationsForbiddenError) return reply.code(403).send({ code: 'DRIVER_OPERATIONS_FORBIDDEN' });
  if (error instanceof DriverOperationsIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof DriverOperationsConflictError) return reply.code(409).send({ code: 'DRIVER_OPERATIONS_STATE_CONFLICT', message: error.message });
  return null;
}

export function registerDriverOperationsRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.post('/v1/driver/applications', async (request, reply) => {
    const principal = await requireDriverPrincipal(request, reply, pool, 'MANAGE_DRIVER_APPLICATION');
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await startOrResumeDriverApplication(pool, principal, key));
    } catch (error) {
      const known = sendDriverOperationsError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver application start/resume failed');
      return reply.code(500).send({ code: 'DRIVER_APPLICATION_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/application', async (request, reply) => {
    const principal = await requireDriverPrincipal(request, reply, pool, 'VIEW_PROFILE');
    if (!principal) return;
    try {
      return reply.code(200).send(await getCurrentDriverApplication(pool, principal));
    } catch (error) {
      const known = sendDriverOperationsError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver application read failed');
      return reply.code(500).send({ code: 'DRIVER_APPLICATION_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/operating-eligibility', async (request, reply) => {
    const principal = await requireDriverPrincipal(request, reply, pool, 'VIEW_PROFILE');
    if (!principal) return;
    const query = z.object({
      regionCode: z.string().trim().min(2).max(32),
      vehicleId: z.string().uuid().optional()
    }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_OPERATING_ELIGIBILITY_QUERY' });
    try {
      return reply.code(200).send(await getDriverOperatingEligibilityProjection(
        pool, principal, query.data.regionCode.toUpperCase(), query.data.vehicleId ?? null
      ));
    } catch (error) {
      const known = sendDriverOperationsError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver operating eligibility read failed');
      return reply.code(500).send({ code: 'DRIVER_OPERATING_ELIGIBILITY_UNAVAILABLE' });
    }
  });
}
