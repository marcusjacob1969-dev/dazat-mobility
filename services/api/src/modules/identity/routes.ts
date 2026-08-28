import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { startAccountRegistration } from './registration-service.js';

const registrationSchema = z.object({
  profileKind: z.enum(['RIDER', 'DRIVER', 'BOTH']),
  preferredName: z.string().trim().min(1).max(100),
  contact: z.object({
    type: z.enum(['EMAIL', 'MOBILE']),
    value: z.string().trim().min(3).max(320)
  })
}).strict();

function hashIp(ip: string): string {
  // Operational abuse correlation only. Do not store raw IP in the registration command record.
  return createHash('sha256').update(ip).digest('hex');
}

export function registerIdentityRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.post('/v1/identity/registrations', async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return reply.code(400).send({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'A stable Idempotency-Key header (8-200 characters) is required.'
      });
    }

    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'INVALID_REGISTRATION_REQUEST',
        message: 'The registration request is invalid.',
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }))
      });
    }

    try {
      const result = await startAccountRegistration(pool, parsed.data, {
        idempotencyKey,
        actorIpHash: hashIp(request.ip)
      });
      return reply.code(202).send(result);
    } catch (error) {
      request.log.error({ err: error }, 'identity registration failed');
      return reply.code(500).send({
        code: 'REGISTRATION_UNAVAILABLE',
        message: 'Registration could not be completed. No authentication secret was accepted.'
      });
    }
  });
}
