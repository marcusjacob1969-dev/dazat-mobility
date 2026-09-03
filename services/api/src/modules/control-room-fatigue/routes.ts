import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  claimFatigueHandover,
  completeFatigueHandover,
  confirmFatigueSafeStop,
  getFatigueHandoverTask,
  recordFatigueReplacementAssignment,
  recordFatiguePassengerTransfer,
  ControlRoomFatigueConflictError,
  ControlRoomFatigueForbiddenError,
  ControlRoomFatigueIdempotencyConflictError,
  ControlRoomFatigueNotFoundError
} from './control-room-fatigue-service.js';

const safeStopSchema = z.object({ evidenceReference: z.string().trim().min(3).max(500) }).strict();
const completionSchema = z.object({ completionEvidenceReference: z.string().trim().min(3).max(500) }).strict();
const replacementSchema = z.object({
  replacementAssignmentId: z.string().uuid(),
  evidenceReference: z.string().trim().min(3).max(500)
}).strict();

function keyFrom(request: FastifyRequest): string | null {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' && value.length >= 8 && value.length <= 200 ? value : null;
}

function sendKnown(reply: FastifyReply, error: unknown) {
  if (error instanceof ControlRoomFatigueForbiddenError) return reply.code(403).send({ code: 'CONTROL_ROOM_AUTHORITY_REQUIRED' });
  if (error instanceof ControlRoomFatigueNotFoundError) return reply.code(404).send({ code: 'CLAIMABLE_FATIGUE_HANDOVER_NOT_FOUND' });
  if (error instanceof ControlRoomFatigueIdempotencyConflictError) return reply.code(409).send({ code: 'IDEMPOTENCY_KEY_REUSED' });
  if (error instanceof ControlRoomFatigueConflictError) return reply.code(409).send({ code: 'CONTROL_ROOM_STATE_CONFLICT' });
  return null;
}

export function registerControlRoomFatigueRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/control-room/fatigue-handovers/:controlledHandoverId', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const actor = await authenticateBearerSession(pool, token, 'SUPPORT');
    if (!actor) return reply.code(401).send({ code: 'SESSION_INVALID_OR_SUPPORT_CAPABILITY_UNAVAILABLE' });
    const params = z.object({ controlledHandoverId: z.string().uuid() }).strict().safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_CONTROLLED_HANDOVER_ID' });
    try {
      return reply.code(200).send(await getFatigueHandoverTask(pool, actor, params.data.controlledHandoverId));
    } catch (error) {
      const known = sendKnown(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Control Room fatigue handover task read failed');
      return reply.code(500).send({ code: 'CONTROL_ROOM_FATIGUE_HANDOVER_UNAVAILABLE' });
    }
  });

  app.post('/v1/control-room/fatigue-handovers/:controlledHandoverId/claim', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const actor = await authenticateBearerSession(pool, token, 'SUPPORT');
    if (!actor) return reply.code(401).send({ code: 'SESSION_INVALID_OR_SUPPORT_CAPABILITY_UNAVAILABLE' });
    const params = z.object({ controlledHandoverId: z.string().uuid() }).strict().safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_CONTROLLED_HANDOVER_ID' });
    const key = keyFrom(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await claimFatigueHandover(pool, actor, params.data.controlledHandoverId, key));
    } catch (error) {
      const known = sendKnown(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Control Room fatigue handover claim failed');
      return reply.code(500).send({ code: 'CONTROL_ROOM_FATIGUE_HANDOVER_UNAVAILABLE' });
    }
  });

  app.post('/v1/control-room/fatigue-handovers/:controlledHandoverId/confirm-safe-stop', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const actor = await authenticateBearerSession(pool, token, 'SAFETY');
    if (!actor) return reply.code(401).send({ code: 'SESSION_INVALID_OR_SAFETY_CAPABILITY_UNAVAILABLE' });
    const params = z.object({ controlledHandoverId: z.string().uuid() }).strict().safeParse(request.params);
    const body = safeStopSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_SAFE_STOP_CONFIRMATION' });
    const key = keyFrom(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await confirmFatigueSafeStop(
        pool, actor, params.data.controlledHandoverId, body.data, key
      ));
    } catch (error) {
      const known = sendKnown(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Control Room fatigue safe-stop confirmation failed');
      return reply.code(500).send({ code: 'CONTROL_ROOM_FATIGUE_SAFE_STOP_UNAVAILABLE' });
    }
  });

  app.post('/v1/control-room/fatigue-handovers/:controlledHandoverId/complete', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const actor = await authenticateBearerSession(pool, token, 'SAFETY');
    if (!actor) return reply.code(401).send({ code: 'SESSION_INVALID_OR_SAFETY_CAPABILITY_UNAVAILABLE' });
    const params = z.object({ controlledHandoverId: z.string().uuid() }).strict().safeParse(request.params);
    const body = completionSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_FATIGUE_HANDOVER_COMPLETION' });
    const key = keyFrom(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await completeFatigueHandover(
        pool, actor, params.data.controlledHandoverId, body.data, key
      ));
    } catch (error) {
      const known = sendKnown(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Control Room fatigue handover completion failed');
      return reply.code(500).send({ code: 'CONTROL_ROOM_FATIGUE_HANDOVER_COMPLETION_UNAVAILABLE' });
    }
  });

  app.post('/v1/control-room/fatigue-handovers/:controlledHandoverId/replacement-assignment', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const actor = await authenticateBearerSession(pool, token, 'SAFETY');
    if (!actor) return reply.code(401).send({ code: 'SESSION_INVALID_OR_SAFETY_CAPABILITY_UNAVAILABLE' });
    const params = z.object({ controlledHandoverId: z.string().uuid() }).strict().safeParse(request.params);
    const body = replacementSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_REPLACEMENT_ASSIGNMENT' });
    const key = keyFrom(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await recordFatigueReplacementAssignment(
        pool, actor, params.data.controlledHandoverId, body.data, key
      ));
    } catch (error) {
      const known = sendKnown(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Control Room fatigue replacement assignment failed');
      return reply.code(500).send({ code: 'CONTROL_ROOM_FATIGUE_REPLACEMENT_UNAVAILABLE' });
    }
  });

  app.post('/v1/control-room/fatigue-handovers/:controlledHandoverId/passenger-transfer', async (request, reply) => {
    const token = bearerTokenFromRequest(request);
    if (!token) return reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' });
    const actor = await authenticateBearerSession(pool, token, 'SAFETY');
    if (!actor) return reply.code(401).send({ code: 'SESSION_INVALID_OR_SAFETY_CAPABILITY_UNAVAILABLE' });
    const params = z.object({ controlledHandoverId: z.string().uuid() }).strict().safeParse(request.params);
    const body = safeStopSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ code: 'INVALID_PASSENGER_TRANSFER' });
    const key = keyFrom(request);
    if (!key) return reply.code(400).send({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    try {
      return reply.code(200).send(await recordFatiguePassengerTransfer(
        pool, actor, params.data.controlledHandoverId, body.data, key
      ));
    } catch (error) {
      const known = sendKnown(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Control Room fatigue passenger transfer failed');
      return reply.code(500).send({ code: 'CONTROL_ROOM_FATIGUE_PASSENGER_TRANSFER_UNAVAILABLE' });
    }
  });
}
