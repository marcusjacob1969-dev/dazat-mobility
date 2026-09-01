import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearerFromRequest } from '../../security/bearer-token.js';
import type { ApiConfig } from '../../config.js';
import { startAccountRegistration } from './registration-service.js';
import {
  confirmContactVerification,
  startContactVerification,
  VerificationCooldownError,
  VerificationExpiredError,
  VerificationInvalidCodeError,
  VerificationLockedError,
  VerificationNotFoundError
} from './contact-verification-service.js';
import type { ContactVerificationDeliveryPort } from './verification-delivery-port.js';
import { authenticateBearerSession, revokeSession } from './session-service.js';
import type { ConfirmContactVerificationRequest, DeviceContextInput } from '@dazat/contracts';

const registrationSchema = z.object({
  profileKind: z.enum(['RIDER', 'DRIVER', 'BOTH']),
  preferredName: z.string().trim().min(1).max(100),
  contact: z.object({
    type: z.enum(['EMAIL', 'MOBILE']),
    value: z.string().trim().min(3).max(320)
  })
}).strict();

const startVerificationSchema = z.object({
  accountId: z.string().uuid(),
  contactPointId: z.string().uuid()
}).strict();

const confirmVerificationSchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
  device: z.object({
    deviceInstanceId: z.string().trim().min(8).max(200),
    platform: z.string().trim().min(1).max(50).optional(),
    appInstallationId: z.string().trim().min(1).max(200).optional()
  }).strict().optional()
}).strict();

function toDeviceContext(device: NonNullable<z.infer<typeof confirmVerificationSchema>['device']>): DeviceContextInput {
  return {
    deviceInstanceId: device.deviceInstanceId,
    ...(device.platform === undefined ? {} : { platform: device.platform }),
    ...(device.appInstallationId === undefined ? {} : { appInstallationId: device.appInstallationId })
  };
}

function hashIp(ip: string): string {
  // Operational abuse correlation only. Do not store raw IP in the registration command record.
  return createHash('sha256').update(ip).digest('hex');
}

async function requirePrincipal(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const bearer = bearerFromRequest(request);
  if (!bearer) {
    await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED', message: 'An authenticated DAZAT session is required.' });
    return null;
  }
  const principal = await authenticateBearerSession(pool, bearer);
  if (!principal) {
    await reply.code(401).send({ code: 'SESSION_INVALID', message: 'The DAZAT session is expired, revoked or unavailable.' });
    return null;
  }
  return principal;
}

export function registerIdentityRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  config: ApiConfig,
  deliveryPort: ContactVerificationDeliveryPort | null
): void {
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

  app.post('/v1/identity/verifications/contact', async (request, reply) => {
    if (!deliveryPort) {
      return reply.code(503).send({
        code: 'VERIFICATION_DELIVERY_NOT_CONFIGURED',
        message: 'Contact verification delivery is not configured in this environment.'
      });
    }
    const parsed = startVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: 'INVALID_VERIFICATION_REQUEST', message: 'Verification request is invalid.' });
    }
    try {
      const result = await startContactVerification(pool, parsed.data, deliveryPort, {
        pepper: config.contactVerificationPepper,
        ttlMinutes: config.contactVerificationTtlMinutes,
        resendSeconds: config.contactVerificationResendSeconds,
        maxAttempts: config.contactVerificationMaxAttempts,
        exposeDevelopmentCode: config.exposeDevelopmentVerificationCode,
        sessionTtlMinutes: config.sessionTtlMinutes
      });
      return reply.code(202).send(result);
    } catch (error) {
      if (error instanceof VerificationCooldownError) {
        reply.header('Retry-After', String(error.retryAfterSeconds));
        return reply.code(429).send({ code: 'VERIFICATION_COOLDOWN', retryAfterSeconds: error.retryAfterSeconds });
      }
      if (error instanceof VerificationNotFoundError) {
        return reply.code(404).send({ code: 'VERIFICATION_TARGET_UNAVAILABLE' });
      }
      request.log.error({ err: error }, 'contact verification start failed');
      return reply.code(500).send({ code: 'VERIFICATION_UNAVAILABLE' });
    }
  });

  app.post('/v1/identity/verifications/contact/confirm', async (request, reply) => {
    const parsed = confirmVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: 'INVALID_VERIFICATION_CONFIRMATION' });
    }
    try {
      const input: ConfirmContactVerificationRequest = {
        verificationId: parsed.data.verificationId,
        code: parsed.data.code,
        ...(parsed.data.device === undefined ? {} : { device: toDeviceContext(parsed.data.device) })
      };
      const result = await confirmContactVerification(pool, input, {
        pepper: config.contactVerificationPepper,
        ttlMinutes: config.contactVerificationTtlMinutes,
        resendSeconds: config.contactVerificationResendSeconds,
        maxAttempts: config.contactVerificationMaxAttempts,
        exposeDevelopmentCode: config.exposeDevelopmentVerificationCode,
        sessionTtlMinutes: config.sessionTtlMinutes
      });
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof VerificationInvalidCodeError) return reply.code(400).send({ code: 'VERIFICATION_CODE_INVALID' });
      if (error instanceof VerificationExpiredError) return reply.code(410).send({ code: 'VERIFICATION_EXPIRED' });
      if (error instanceof VerificationLockedError) return reply.code(423).send({ code: 'VERIFICATION_LOCKED' });
      if (error instanceof VerificationNotFoundError) return reply.code(404).send({ code: 'VERIFICATION_NOT_FOUND' });
      request.log.error({ err: error }, 'contact verification confirm failed');
      return reply.code(500).send({ code: 'VERIFICATION_CONFIRMATION_UNAVAILABLE' });
    }
  });

  app.get('/v1/identity/session', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    return reply.code(200).send({
      accountId: principal.accountId,
      personId: principal.personId,
      accountStatus: principal.accountStatus,
      sessionId: principal.sessionId,
      authStrength: principal.authStrength,
      expiresAt: principal.expiresAt.toISOString(),
      ...(principal.riderProfileId ? { riderProfileId: principal.riderProfileId } : {}),
      ...(principal.driverProfileId ? { driverProfileId: principal.driverProfileId } : {})
    });
  });

  app.delete('/v1/identity/session', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    await revokeSession(pool, principal.sessionId);
    return reply.code(204).send();
  });

  app.post('/v1/identity/passkeys/registrations/options', async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool);
    if (!principal) return;
    // Do not fake a WebAuthn ceremony. Phase 0.3 keeps the provider-neutral boundary and fails closed
    // until a standards-compliant ceremony adapter is installed and verified.
    return reply.code(503).send({
      code: 'PASSKEY_CEREMONY_PROVIDER_NOT_CONFIGURED',
      message: 'Passkey registration is architecturally ready but no verified WebAuthn ceremony provider is configured.'
    });
  });
}
