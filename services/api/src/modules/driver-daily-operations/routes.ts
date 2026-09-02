import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AccountCapability } from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import type { ApiConfig } from '../../config.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  DriverDailyOperationsConflictError,
  DriverDailyOperationsForbiddenError,
  DriverDailyOperationsIdempotencyConflictError,
  DriverDailyOperationsNotFoundError,
  getArrivalCommunicationPlan,
  getDriverDailyOperations,
  getDriverSupplyDemand,
  listDriverSupportCases,
  openDriverSupportCase,
  reportDriverFatigue,
  reconcileDriverConnectivity
} from './driver-daily-operations-service.js';
import type { ConnectivityReconciliationRequest, DriverFatigueSelfReportRequest, OpenDriverSupportCaseRequest } from '@dazat/contracts';

const queuedCriticalEventSchema = z.object({
  clientEventId: z.string().uuid(),
  kind: z.enum(['SOS', 'SILENT_ASSISTANCE', 'RIDER_CONDUCT', 'LOCATION_OBSERVATION', 'ARRIVAL_COMMUNICATION_ACK']),
  observedAt: z.string().datetime({ offset: true })
}).strict();

const connectivitySchema = z.object({
  clientObservationId: z.string().uuid(),
  networkReachable: z.boolean(),
  observedAt: z.string().datetime({ offset: true }),
  lastServerSyncAt: z.string().datetime({ offset: true }).optional(),
  knownAvailabilityVersion: z.number().int().positive().optional(),
  knownActiveJourneyId: z.string().uuid().optional(),
  knownActiveJourneyVersion: z.number().int().positive().optional(),
  queuedCriticalEvents: z.array(queuedCriticalEventSchema).max(50)
}).strict();

const supportCaseSchema = z.object({
  category: z.enum(['SAFETY', 'BREAKDOWN', 'PAYMENTS', 'ACCOUNT', 'COMPLIANCE', 'TECHNICAL', 'PASSENGER', 'FLEET']),
  summaryReference: z.string().trim().min(3).max(2_000),
  journeyId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  immediateDanger: z.boolean(),
  serviceContinuityAtRisk: z.boolean()
}).strict();

const fatigueSelfReportSchema = z.object({
  observedAt: z.string().datetime({ offset: true }),
  evidenceReference: z.string().trim().min(3).max(500),
  immediateDanger: z.boolean()
}).strict();

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
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_DRIVER_CAPABILITY_UNAVAILABLE' }); return null; }
  if (!principal.driverProfileId) { await reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' }); return null; }
  return principal;
}

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof DriverDailyOperationsNotFoundError) return reply.code(404).send({ code: 'DRIVER_DAILY_OPERATIONS_RESOURCE_NOT_FOUND' });
  if (error instanceof DriverDailyOperationsForbiddenError) return reply.code(403).send({ code: 'DRIVER_DAILY_OPERATIONS_FORBIDDEN' });
  if (error instanceof DriverDailyOperationsIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof DriverDailyOperationsConflictError) return reply.code(409).send({ code: 'DRIVER_DAILY_OPERATIONS_STATE_CONFLICT', message: error.message });
  return null;
}

export function registerDriverDailyOperationsRoutes(app: FastifyInstance, pool: DatabasePool, config: ApiConfig): void {
  app.get('/v1/driver/daily-operations', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE');
    if (!principal) return;
    try {
      return reply.code(200).send(await getDriverDailyOperations(pool, principal, config));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver daily operations projection failed');
      return reply.code(500).send({ code: 'DRIVER_DAILY_OPERATIONS_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/connectivity/reconciliations', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE');
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const body = connectivitySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_CONNECTIVITY_RECONCILIATION' });
    try {
      const input: ConnectivityReconciliationRequest = {
        clientObservationId: body.data.clientObservationId,
        networkReachable: body.data.networkReachable,
        observedAt: body.data.observedAt,
        queuedCriticalEvents: body.data.queuedCriticalEvents,
        ...(body.data.lastServerSyncAt === undefined ? {} : { lastServerSyncAt: body.data.lastServerSyncAt }),
        ...(body.data.knownAvailabilityVersion === undefined ? {} : { knownAvailabilityVersion: body.data.knownAvailabilityVersion }),
        ...(body.data.knownActiveJourneyId === undefined ? {} : { knownActiveJourneyId: body.data.knownActiveJourneyId }),
        ...(body.data.knownActiveJourneyVersion === undefined ? {} : { knownActiveJourneyVersion: body.data.knownActiveJourneyVersion })
      };
      return reply.code(200).send(await reconcileDriverConnectivity(pool, principal, input, key, config));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver connectivity reconciliation failed');
      return reply.code(500).send({ code: 'DRIVER_CONNECTIVITY_RECONCILIATION_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/fatigue-reports', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'ACTIVE_JOURNEY');
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const body = fatigueSelfReportSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_DRIVER_FATIGUE_REPORT' });
    try {
      const input: DriverFatigueSelfReportRequest = body.data;
      return reply.code(201).send(await reportDriverFatigue(pool, principal, input, key));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver fatigue self-report failed');
      return reply.code(500).send({ code: 'DRIVER_FATIGUE_REPORT_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/support-cases', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'SUPPORT');
    if (!principal) return;
    const key = idempotencyKey(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    const body = supportCaseSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_DRIVER_SUPPORT_CASE' });
    try {
      const input: OpenDriverSupportCaseRequest = {
        category: body.data.category,
        summaryReference: body.data.summaryReference,
        immediateDanger: body.data.immediateDanger,
        serviceContinuityAtRisk: body.data.serviceContinuityAtRisk,
        ...(body.data.journeyId === undefined ? {} : { journeyId: body.data.journeyId }),
        ...(body.data.bookingId === undefined ? {} : { bookingId: body.data.bookingId }),
        ...(body.data.vehicleId === undefined ? {} : { vehicleId: body.data.vehicleId })
      };
      return reply.code(201).send(await openDriverSupportCase(pool, principal, input, key));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver support case creation failed');
      return reply.code(500).send({ code: 'DRIVER_SUPPORT_CASE_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/support-cases', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'SUPPORT');
    if (!principal) return;
    try {
      return reply.code(200).send({ cases: await listDriverSupportCases(pool, principal) });
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver support case read failed');
      return reply.code(500).send({ code: 'DRIVER_SUPPORT_CASES_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/supply-demand', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE');
    if (!principal) return;
    const query = z.object({
      regionCode: z.string().trim().min(2).max(32),
      capabilityCodes: z.string().trim().max(500).optional()
    }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_SUPPLY_DEMAND_QUERY' });
    const capabilities = [...new Set((query.data.capabilityCodes ?? '').split(',')
      .map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
    try {
      return reply.code(200).send(await getDriverSupplyDemand(pool, principal, query.data.regionCode.toUpperCase(), capabilities));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver supply/demand read failed');
      return reply.code(500).send({ code: 'DRIVER_SUPPLY_DEMAND_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/bookings/:bookingId/arrival-plan', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'ACTIVE_JOURNEY');
    if (!principal) return;
    const params = z.object({ bookingId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_BOOKING_ID' });
    try {
      return reply.code(200).send(await getArrivalCommunicationPlan(pool, principal, params.data.bookingId));
    } catch (error) {
      const known = sendError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Arrival communication plan read failed');
      return reply.code(500).send({ code: 'ARRIVAL_COMMUNICATION_PLAN_UNAVAILABLE' });
    }
  });
}
