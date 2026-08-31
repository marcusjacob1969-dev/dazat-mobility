import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AccountCapability } from '@dazat/domain';
import type { SubmitDriverAppealRequest, SubmitRiderConductReportRequest } from '@dazat/contracts';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  DriverFairTreatmentConflictError,
  DriverFairTreatmentForbiddenError,
  DriverFairTreatmentIdempotencyConflictError,
  DriverFairTreatmentNotFoundError,
  getDriverFairTreatmentProjection,
  listCurrentDriverIncentives,
  safelyTerminateUnsafeJourney,
  submitDriverAppeal,
  submitRiderConductReport
} from './driver-fair-treatment-service.js';

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
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID_OR_DRIVER_CAPABILITY_UNAVAILABLE' }); return null; }
  if (!principal.driverProfileId) { await reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' }); return null; }
  return principal;
}

function sendFairTreatmentError(reply: FastifyReply, error: unknown) {
  if (error instanceof DriverFairTreatmentNotFoundError) return reply.code(404).send({ code: 'FAIR_TREATMENT_RESOURCE_NOT_FOUND' });
  if (error instanceof DriverFairTreatmentForbiddenError) return reply.code(403).send({ code: 'FAIR_TREATMENT_FORBIDDEN' });
  if (error instanceof DriverFairTreatmentIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof DriverFairTreatmentConflictError) return reply.code(409).send({ code: 'FAIR_TREATMENT_STATE_CONFLICT', message: error.message });
  return null;
}

const categories = z.array(z.enum([
  'VIOLENCE', 'HARASSMENT', 'DISCRIMINATION', 'FRAUD',
  'DANGEROUS_BEHAVIOUR', 'CONTACT_ABUSE', 'OTHER'
])).min(1).max(7).transform((values) => [...new Set(values)]);

const conductBody = z.object({
  journeyId: z.string().uuid(),
  categories,
  reportReference: z.string().trim().min(1).max(500),
  immediateDanger: z.boolean()
}).strict();

const terminationBody = z.object({
  categories,
  reportReference: z.string().trim().min(1).max(500),
  immediateDanger: z.boolean()
}).strict();

const appealBody = z.object({
  subjectType: z.enum(['COMPLAINT_FINDING', 'DRIVER_RESTRICTION', 'OFFBOARDING_DECISION', 'INCENTIVE_QUALIFICATION']),
  subjectId: z.string().uuid(),
  reasonCategory: z.enum(['FACTUAL_ERROR', 'MISSING_EVIDENCE', 'PROCEDURAL_FAIRNESS', 'DISPROPORTIONATE_ACTION', 'OTHER']),
  statementReference: z.string().trim().min(1).max(500),
  evidenceReferences: z.array(z.string().trim().min(1).max(500)).max(20).optional()
}).strict();

export function registerDriverFairTreatmentRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/driver/fair-treatment', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE'); if (!principal) return;
    try {
      return reply.code(200).send(await getDriverFairTreatmentProjection(pool, principal));
    } catch (error) {
      const known = sendFairTreatmentError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver fair-treatment projection failed');
      return reply.code(500).send({ code: 'FAIR_TREATMENT_PROJECTION_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/rider-conduct-cases', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'SAFETY'); if (!principal) return;
    const body = conductBody.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_RIDER_CONDUCT_REPORT' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const validated: SubmitRiderConductReportRequest = body.data;
      return reply.code(201).send(await submitRiderConductReport(pool, principal, validated, key));
    } catch (error) {
      const known = sendFairTreatmentError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Rider-conduct Safety report failed');
      return reply.code(500).send({ code: 'RIDER_CONDUCT_REPORT_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/journeys/:journeyId/unsafe-termination', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'SAFETY'); if (!principal) return;
    const params = z.object({ journeyId: z.string().uuid() }).strict().safeParse(request.params);
    const body = terminationBody.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_UNSAFE_JOURNEY_TERMINATION' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const validated: SubmitRiderConductReportRequest = { journeyId: params.data.journeyId, ...body.data };
      return reply.code(201).send(await safelyTerminateUnsafeJourney(pool, principal, validated, key));
    } catch (error) {
      const known = sendFairTreatmentError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Unsafe Journey termination failed');
      return reply.code(500).send({ code: 'UNSAFE_JOURNEY_TERMINATION_UNAVAILABLE' });
    }
  });

  app.post('/v1/driver/appeals', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE'); if (!principal) return;
    const body = appealBody.safeParse(request.body);
    const key = idempotencyKey(request);
    if (!body.success) return reply.code(400).send({ code: 'INVALID_DRIVER_APPEAL' });
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      const validated: SubmitDriverAppealRequest = {
        subjectType: body.data.subjectType,
        subjectId: body.data.subjectId,
        reasonCategory: body.data.reasonCategory,
        statementReference: body.data.statementReference,
        ...(body.data.evidenceReferences === undefined ? {} : { evidenceReferences: body.data.evidenceReferences })
      };
      return reply.code(201).send(await submitDriverAppeal(pool, principal, validated, key));
    } catch (error) {
      const known = sendFairTreatmentError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver appeal submission failed');
      return reply.code(500).send({ code: 'DRIVER_APPEAL_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/incentives', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool, 'VIEW_PROFILE'); if (!principal) return;
    const query = z.object({ regionCode: z.string().trim().min(2).max(32) }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_DRIVER_INCENTIVE_QUERY' });
    try {
      return reply.code(200).send({ incentives: await listCurrentDriverIncentives(
        pool, principal, query.data.regionCode.toUpperCase()
      ) });
    } catch (error) {
      const known = sendFairTreatmentError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Driver incentive read failed');
      return reply.code(500).send({ code: 'DRIVER_INCENTIVES_UNAVAILABLE' });
    }
  });
}
