import type { PoolClient } from 'pg';
import type { DatabasePool } from '../../db.js';
import { canUseAccountCapability, isSessionAuthoritative, type AccountCapability, type AccountStatus, type SessionStatus } from '@dazat/domain';
import { hashOpaqueSecret, issueOpaqueSecret } from '../../security/secret-utils.js';

export interface AuthenticatedPrincipal {
  readonly accountId: string;
  readonly personId: string;
  readonly accountStatus: AccountStatus;
  readonly sessionId: string;
  readonly authStrength: string;
  readonly expiresAt: Date;
  readonly riderProfileId?: string;
  readonly driverProfileId?: string;
}

export interface DeviceSessionContext {
  readonly deviceInstanceId: string;
  readonly platform?: string;
  readonly appInstallationId?: string;
}

export interface CreatedSession {
  readonly sessionId: string;
  readonly bearerToken: string;
  readonly expiresAt: Date;
}

export async function createVerifiedContactSession(
  client: PoolClient,
  accountId: string,
  authStrength: 'VERIFIED_CONTACT',
  ttlMinutes: number,
  device?: DeviceSessionContext
): Promise<CreatedSession> {
  const { bearerSecret, persistedHash } = issueOpaqueSecret('dzs');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  let deviceTrustRecordId: string | null = null;

  if (device) {
    const deviceResult = await client.query<{ id: string }>(
      `INSERT INTO identity.device_trust_record
         (user_account_id, device_instance_id, platform, app_installation_id, credential_type,
          trust_status, last_successful_authentication_at, last_seen_at)
       VALUES ($1, $2, $3, $4, 'VERIFIED_CONTACT', 'RECOGNISED', now(), now())
       ON CONFLICT (user_account_id, device_instance_id)
       DO UPDATE SET
         platform = COALESCE(EXCLUDED.platform, identity.device_trust_record.platform),
         app_installation_id = COALESCE(EXCLUDED.app_installation_id, identity.device_trust_record.app_installation_id),
         credential_type = 'VERIFIED_CONTACT',
         trust_status = CASE
           WHEN identity.device_trust_record.trust_status IN ('TRUSTED','RESTRICTED','REVOKED')
             THEN identity.device_trust_record.trust_status
           ELSE 'RECOGNISED'
         END,
         last_successful_authentication_at = now(),
         last_seen_at = now()
       RETURNING id`,
      [accountId, device.deviceInstanceId, device.platform ?? null, device.appInstallationId ?? null]
    );
    deviceTrustRecordId = deviceResult.rows[0]!.id;
  }

  const session = await client.query<{ id: string }>(
    `INSERT INTO identity.session
       (user_account_id, device_trust_record_id, status, auth_strength, session_token_hash, expires_at)
     VALUES ($1, $2, 'ACTIVE', $3, $4, $5)
     RETURNING id`,
    [accountId, deviceTrustRecordId, authStrength, persistedHash, expiresAt.toISOString()]
  );

  return { sessionId: session.rows[0]!.id, bearerToken: bearerSecret, expiresAt };
}

export async function authenticateBearerSession(
  pool: DatabasePool,
  bearerToken: string,
  requiredCapability?: AccountCapability
): Promise<AuthenticatedPrincipal | null> {
  if (!bearerToken.startsWith('dzs_') || bearerToken.length < 30) return null;
  const tokenHash = hashOpaqueSecret(bearerToken);
  const result = await pool.query<{
    session_id: string;
    session_status: SessionStatus;
    auth_strength: string;
    expires_at: Date;
    account_id: string;
    account_status: AccountStatus;
    person_id: string;
    rider_profile_id: string | null;
    driver_profile_id: string | null;
  }>(
    `SELECT s.id AS session_id,
            s.status AS session_status,
            s.auth_strength,
            s.expires_at,
            a.id AS account_id,
            a.status AS account_status,
            a.person_id,
            r.id AS rider_profile_id,
            d.id AS driver_profile_id
       FROM identity.session s
       JOIN identity.user_account a ON a.id = s.user_account_id
       LEFT JOIN rider.rider_profile r ON r.person_id = a.person_id
       LEFT JOIN driver.driver_profile d ON d.person_id = a.person_id
      WHERE s.session_token_hash = $1
      LIMIT 1`,
    [tokenHash]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0]!;
  if (!isSessionAuthoritative(row.session_status, row.expires_at)) return null;
  if (requiredCapability && !canUseAccountCapability(row.account_status, requiredCapability)) return null;

  await pool.query('UPDATE identity.session SET last_seen_at = now() WHERE id = $1', [row.session_id]);

  return {
    accountId: row.account_id,
    personId: row.person_id,
    accountStatus: row.account_status,
    sessionId: row.session_id,
    authStrength: row.auth_strength,
    expiresAt: row.expires_at,
    ...(row.rider_profile_id ? { riderProfileId: row.rider_profile_id } : {}),
    ...(row.driver_profile_id ? { driverProfileId: row.driver_profile_id } : {})
  };
}

export async function revokeSession(pool: DatabasePool, sessionId: string, reason = 'USER_SIGN_OUT'): Promise<void> {
  await pool.query(
    `UPDATE identity.session
        SET status = 'REVOKED', revoked_at = now(), revoke_reason = $2
      WHERE id = $1 AND status IN ('ACTIVE','STEP_UP_REQUIRED')`,
    [sessionId, reason]
  );
}
