import { randomInt, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabasePool } from '../../db.js';
import { normaliseVerificationCode } from '@dazat/domain';
import type {
  AuthenticatedSessionResult,
  ConfirmContactVerificationRequest,
  RegistrationContactType,
  StartContactVerificationRequest,
  StartContactVerificationResult
} from '@dazat/contracts';
import { constantTimeHexEqual, createVerificationSalt, hashVerificationCode } from '../../security/secret-utils.js';
import type { ContactVerificationDeliveryPort } from './verification-delivery-port.js';
import { createVerifiedContactSession } from './session-service.js';

export class VerificationNotFoundError extends Error {}
export class VerificationCooldownError extends Error {
  public constructor(public readonly retryAfterSeconds: number) {
    super('Verification resend is temporarily unavailable');
  }
}
export class VerificationInvalidCodeError extends Error {}
export class VerificationExpiredError extends Error {}
export class VerificationLockedError extends Error {}

export interface ContactVerificationConfig {
  readonly pepper: string;
  readonly ttlMinutes: number;
  readonly resendSeconds: number;
  readonly maxAttempts: number;
  readonly exposeDevelopmentCode: boolean;
  readonly sessionTtlMinutes: number;
}

interface PendingContactRow {
  account_id: string;
  account_status: 'PENDING' | 'ACTIVE' | 'LIMITED' | 'SUSPENDED' | 'CLOSED';
  contact_point_id: string;
  contact_type: RegistrationContactType;
  normalized_value: string;
  display_hint: string;
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function loadOwnedContact(client: PoolClient, request: StartContactVerificationRequest): Promise<PendingContactRow> {
  const result = await client.query<PendingContactRow>(
    `SELECT a.id AS account_id,
            a.status AS account_status,
            c.id AS contact_point_id,
            c.type AS contact_type,
            c.normalized_value,
            c.display_hint
       FROM identity.user_account a
       JOIN identity.contact_point c ON c.user_account_id = a.id
      WHERE a.id = $1 AND c.id = $2 AND c.status = 'ACTIVE'
      LIMIT 1
      FOR UPDATE OF c`,
    [request.accountId, request.contactPointId]
  );
  if (!result.rowCount) throw new VerificationNotFoundError('Account/contact verification target not found');
  const row = result.rows[0]!;
  if (!['PENDING', 'ACTIVE', 'LIMITED'].includes(row.account_status)) {
    throw new VerificationNotFoundError('Account/contact verification target unavailable');
  }
  return row;
}

export async function startContactVerification(
  pool: DatabasePool,
  request: StartContactVerificationRequest,
  deliveryPort: ContactVerificationDeliveryPort,
  config: ContactVerificationConfig
): Promise<StartContactVerificationResult> {
  const client = await pool.connect();
  const verificationId = randomUUID();
  const code = generateCode();
  const salt = createVerificationSalt();
  const challengeHash = hashVerificationCode(config.pepper, verificationId, salt, code);
  const expiresAt = new Date(Date.now() + config.ttlMinutes * 60_000);
  const resendAvailableAt = new Date(Date.now() + config.resendSeconds * 1_000);
  let contact!: PendingContactRow;

  try {
    await client.query('BEGIN');
    contact = await loadOwnedContact(client, request);

    const recent = await client.query<{ attempted_at: Date }>(
      `SELECT attempted_at
         FROM identity.verification_record
        WHERE contact_point_id = $1 AND purpose = 'ACCOUNT_REGISTRATION' AND status = 'PENDING'
        ORDER BY attempted_at DESC
        LIMIT 1`,
      [contact.contact_point_id]
    );
    if (recent.rowCount) {
      const elapsedSeconds = Math.floor((Date.now() - recent.rows[0]!.attempted_at.getTime()) / 1000);
      if (elapsedSeconds < config.resendSeconds) {
        throw new VerificationCooldownError(config.resendSeconds - elapsedSeconds);
      }
    }

    await client.query(
      `UPDATE identity.verification_record
          SET status = 'EXPIRED'
        WHERE contact_point_id = $1
          AND purpose = 'ACCOUNT_REGISTRATION'
          AND status = 'PENDING'`,
      [contact.contact_point_id]
    );

    await client.query(
      `INSERT INTO identity.verification_record
         (id, contact_point_id, purpose, method, status, challenge_salt, challenge_hash,
          attempt_count, max_attempts, expires_at, metadata)
       VALUES ($1, $2, 'ACCOUNT_REGISTRATION', $3, 'PENDING', $4, $5, 0, $6, $7, '{}'::jsonb)`,
      [verificationId, contact.contact_point_id, contact.contact_type, salt, challengeHash, config.maxAttempts, expiresAt.toISOString()]
    );

    await client.query(
      `INSERT INTO identity.outbox_message
         (aggregate_type, aggregate_id, event_type, correlation_id, payload)
       VALUES ('UserAccount', $1, 'identity.contact.verification_requested', $2, $3::jsonb)`,
      [
        contact.account_id,
        randomUUID(),
        JSON.stringify({
          accountId: contact.account_id,
          contactPointId: contact.contact_point_id,
          verificationId,
          contactType: contact.contact_type,
          expiresAt: expiresAt.toISOString()
        })
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  let deliveryState: 'DELIVERED' | 'UNKNOWN' = 'UNKNOWN';
  try {
    deliveryState = await deliveryPort.sendVerificationCode({
      verificationId,
      contactPointId: contact.contact_point_id,
      type: contact.contact_type,
      normalizedValue: contact.normalized_value,
      displayHint: contact.display_hint,
      code,
      expiresAt: expiresAt.toISOString()
    });
  } catch {
    // Delivery outcome is intentionally UNKNOWN. A provider timeout is not rewritten as a failed verification.
    deliveryState = 'UNKNOWN';
  }

  return {
    verificationId,
    status: 'PENDING',
    contact: {
      id: contact.contact_point_id,
      type: contact.contact_type,
      displayHint: contact.display_hint
    },
    expiresAt: expiresAt.toISOString(),
    resendAvailableAt: resendAvailableAt.toISOString(),
    deliveryState,
    ...(config.exposeDevelopmentCode ? { developmentCode: code } : {})
  };
}

export async function confirmContactVerification(
  pool: DatabasePool,
  request: ConfirmContactVerificationRequest,
  config: ContactVerificationConfig
): Promise<AuthenticatedSessionResult> {
  const code = normaliseVerificationCode(request.code);
  const client = await pool.connect();
  const commandId = randomUUID();
  let committedError: Error | null = null;

  try {
    await client.query('BEGIN');
    const result = await client.query<{
      id: string;
      contact_point_id: string;
      status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'REVOKED';
      challenge_salt: string | null;
      challenge_hash: string | null;
      attempt_count: number;
      max_attempts: number;
      expires_at: Date | null;
      account_id: string;
      account_status: 'PENDING' | 'ACTIVE' | 'LIMITED' | 'SUSPENDED' | 'CLOSED';
    }>(
      `SELECT v.id, v.contact_point_id, v.status, v.challenge_salt, v.challenge_hash,
              v.attempt_count, v.max_attempts, v.expires_at,
              a.id AS account_id, a.status AS account_status
         FROM identity.verification_record v
         JOIN identity.contact_point c ON c.id = v.contact_point_id
         JOIN identity.user_account a ON a.id = c.user_account_id
        WHERE v.id = $1 AND v.purpose = 'ACCOUNT_REGISTRATION'
        LIMIT 1
        FOR UPDATE OF v, a`,
      [request.verificationId]
    );
    if (!result.rowCount) throw new VerificationNotFoundError('Verification not found');
    const row = result.rows[0]!;

    if (row.status !== 'PENDING') {
      throw row.status === 'EXPIRED' ? new VerificationExpiredError('Verification expired') : new VerificationLockedError('Verification is not active');
    }
    if (!row.expires_at || row.expires_at.getTime() <= Date.now()) {
      await client.query(`UPDATE identity.verification_record SET status = 'EXPIRED' WHERE id = $1`, [row.id]);
      await client.query('COMMIT');
      committedError = new VerificationExpiredError('Verification expired');
    } else if (row.attempt_count >= row.max_attempts) {
      await client.query(`UPDATE identity.verification_record SET status = 'FAILED' WHERE id = $1`, [row.id]);
      await client.query('COMMIT');
      committedError = new VerificationLockedError('Verification attempts exhausted');
    } else if (!row.challenge_salt || !row.challenge_hash) {
      throw new VerificationLockedError('Verification challenge verifier missing');
    } else {
      const actualHash = hashVerificationCode(config.pepper, row.id, row.challenge_salt, code);
      const nextAttemptCount = row.attempt_count + 1;
      if (!constantTimeHexEqual(row.challenge_hash, actualHash)) {
        const nextStatus = nextAttemptCount >= row.max_attempts ? 'FAILED' : 'PENDING';
        await client.query(
          `UPDATE identity.verification_record
              SET attempt_count = $2, status = $3::identity.verification_status
            WHERE id = $1`,
          [row.id, nextAttemptCount, nextStatus]
        );
        await client.query('COMMIT');
        committedError = nextStatus === 'FAILED'
          ? new VerificationLockedError('Verification attempts exhausted')
          : new VerificationInvalidCodeError('Verification code invalid');
      } else {
        await client.query(
          `UPDATE identity.verification_record
              SET attempt_count = $2, status = 'VERIFIED', verified_at = now(), consumed_at = now()
            WHERE id = $1`,
          [row.id, nextAttemptCount]
        );

        await client.query(
          `INSERT INTO identity.authenticator
             (user_account_id, type, status, label, provider_reference, last_used_at)
           VALUES ($1, 'VERIFIED_CONTACT', 'ACTIVE', 'Verified contact', $2, now())
           ON CONFLICT DO NOTHING`,
          [row.account_id, row.contact_point_id]
        );

        let accountStatus: 'ACTIVE' | 'LIMITED';
        if (row.account_status === 'PENDING') {
          await client.query(
            `UPDATE identity.user_account SET status = 'ACTIVE', updated_at = now() WHERE id = $1`,
            [row.account_id]
          );
          await client.query(
            `INSERT INTO identity.account_status_transition
               (user_account_id, from_status, to_status, command_id, reason_code, actor_type)
             VALUES ($1, 'PENDING', 'ACTIVE', $2, 'CONTACT_VERIFIED', 'SELF_SERVICE')`,
            [row.account_id, commandId]
          );
          accountStatus = 'ACTIVE';
        } else if (row.account_status === 'ACTIVE' || row.account_status === 'LIMITED') {
          accountStatus = row.account_status;
        } else {
          throw new VerificationLockedError('Account cannot establish a session');
        }

        const createdSession = await createVerifiedContactSession(
          client,
          row.account_id,
          'VERIFIED_CONTACT',
          config.sessionTtlMinutes,
          request.device
        );

        await client.query(
          `INSERT INTO identity.outbox_message
             (aggregate_type, aggregate_id, event_type, correlation_id, causation_id, payload)
           VALUES ('UserAccount', $1, 'identity.contact.verified', $2, $3, $4::jsonb),
                  ('UserAccount', $1, 'identity.session.started', $2, $3, $5::jsonb)`,
          [
            row.account_id,
            randomUUID(),
            commandId,
            JSON.stringify({ accountId: row.account_id, contactPointId: row.contact_point_id, verificationId: row.id }),
            JSON.stringify({ accountId: row.account_id, sessionId: createdSession.sessionId, authStrength: 'VERIFIED_CONTACT' })
          ]
        );

        await client.query('COMMIT');
        return {
          accountId: row.account_id,
          accountStatus,
          session: {
            id: createdSession.sessionId,
            bearerToken: createdSession.bearerToken,
            authStrength: 'VERIFIED_CONTACT',
            expiresAt: createdSession.expiresAt.toISOString()
          },
          nextAction: 'AUTHENTICATED'
        };
      }
    }
  } catch (error) {
    if (!committedError) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (committedError) throw committedError;
  throw new VerificationLockedError('Verification could not be completed');
}
