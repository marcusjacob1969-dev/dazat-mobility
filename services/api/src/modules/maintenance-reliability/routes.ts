import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AccountCapability } from '@dazat/domain';
import type { SubmitPreShiftCheckRequest } from '@dazat/contracts';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  MaintenanceReliabilityConflictError,
  MaintenanceReliabilityForbiddenError,
  MaintenanceReliabilityIdempotencyConflictError,
  MaintenanceReliabilityNotFoundError,
  getDriverVehicleMaintenanceProjection,
  listCurrentVerifiedDriverPerks,
  submitDriverPreShiftCheck
} from './maintenance-reliability-service.js';

function bearer(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

function idempotencyKey(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

async function requireDriver(
  request: FastifyRequest,
  reply: FastifyReply,
  pool: DatabasePool,
  capability: AccountCapability
) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, capability);
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_CAPABILITY_UNAVAILABLE' }); return null; }
  if (!principal.driverProfileId) { await reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' }); return null; }
  return principal;
}

function sendMaintenanceError(reply: FastifyReply, error: unknown) {
  if (error instanceof MaintenanceReliabilityNotFoundError) return reply.code(404).send({ code: 'MAINTENANCE_RESOURCE_NOT_FOUND' });
  if (error instanceof MaintenanceReliabilityForbiddenError) return reply.code(403).send({ code: 'MAINTENANCE_FORBIDDEN' });
  if (error instanceof MaintenanceReliabilityIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof MaintenanceReliabilityConflictError) return reply.code(409).send({ code: 'MAINTENANCE_STATE_CONFLICT', message: error.message });
  return null;
}

const vehicleParams = z.object({ vehicleId: z.string().uuid() }).strict();
const itemResult = z.enum(['PASS', 'FAIL', 'NOT_SURE', 'NOT_APPLICABLE']);
const mandatoryItemResult = z.enum(['PASS', 'FAIL', 'NOT_SURE']);
const preShiftBody = z.object({
  occurredAt: z.string().datetime({ offset: true }),
  odometer: z.number().int().nonnegative().max(10_000_000),
  items: z.object({
    TYRES: mandatoryItemResult,
    LIGHTS: mandatoryItemResult,
    BRAKES: mandatoryItemResult,
    STEERING: mandatoryItemResult,
    MIRRORS: mandatoryItemResult,
    SEATBELTS: mandatoryItemResult,
    WARNING_INDICATORS: mandatoryItemResult,
    ACCESSIBILITY_EQUIPMENT: itemResult
  }).strict(),
  uncertainConcernText: z.string().trim().min(1).max(1_000).optional(),
  evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(20).optional()
}).strict();

export function registerMaintenanceReliabilityRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/driver/vehicles/:vehicleId/maintenance', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE'); if (!principal) return;
    const params = vehicleParams.safeParse(request.params);
    const query = z.object({ serviceCodes: z.string().trim().max(500).optional() }).strict().safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ code: 'INVALID_MAINTENANCE_QUERY' });
    const serviceCodes = [...new Set((query.data.serviceCodes ?? '').split(',')
      .map((value) => value.trim().toUpperCase()).filter(Boolean))];
    try {
      return reply.code(200).send(await getDriverVehicleMaintenanceProjection(
        pool, principal, params.data.vehicleId, serviceCodes
      ));
    } catch (error) {
      const known = sendMaintenanceError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Vehicle maintenance projection failed');
      return reply.code(500).send({ code: 'MAINTENANCE_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/vehicles/:vehicleId/pre-shift-checks', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'SAFETY'); if (!principal) return;
    const params = vehicleParams.safeParse(request.params);
    const body = preShiftBody.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_PRE_SHIFT_CHECK' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const validatedRequest: SubmitPreShiftCheckRequest = {
        occurredAt: body.data.occurredAt,
        odometer: body.data.odometer,
        items: body.data.items,
        ...(body.data.uncertainConcernText === undefined ? {} : { uncertainConcernText: body.data.uncertainConcernText }),
        ...(body.data.evidenceReferences === undefined ? {} : { evidenceReferences: body.data.evidenceReferences })
      };
      return reply.code(200).send(await submitDriverPreShiftCheck(
        pool, principal, params.data.vehicleId, validatedRequest, key
      ));
    } catch (error) {
      const known = sendMaintenanceError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Pre-shift check submission failed');
      return reply.code(500).send({ code: 'PRE_SHIFT_CHECK_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/perks', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE'); if (!principal) return;
    const query = z.object({ regionCode: z.string().trim().min(2).max(32) }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_PERKS_QUERY' });
    try {
      return reply.code(200).send({ perks: await listCurrentVerifiedDriverPerks(
        pool, principal, query.data.regionCode.toUpperCase()
      ) });
    } catch (error) {
      const known = sendMaintenanceError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Verified Driver perks read failed');
      return reply.code(500).send({ code: 'DRIVER_PERKS_UNAVAILABLE' });
    }
  });
}
