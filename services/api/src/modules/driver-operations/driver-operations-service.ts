import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DriverApplicationProjection, DriverOperatingEligibilityProjection } from '@dazat/contracts';
import {
  evaluateDriverOperatingEligibility,
  type DriverApplicationStatus,
  type DriverRestrictionScope
} from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class DriverOperationsNotFoundError extends Error {}
export class DriverOperationsForbiddenError extends Error {}
export class DriverOperationsConflictError extends Error {}
export class DriverOperationsIdempotencyConflictError extends Error {}

const APPLICATION_POLICY_VERSION = 'driver-onboarding-foundation-v1';

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function nextAction(status: DriverApplicationStatus): DriverApplicationProjection['nextAction'] {
  if (status === 'STARTED') return 'CONTACT_VERIFICATION_REQUIRED';
  if (status === 'CONTACT_VERIFIED' || status === 'IDENTITY_PENDING') return 'IDENTITY_VERIFICATION_REQUIRED';
  if (status === 'DOCUMENTS_PENDING') return 'DOCUMENTS_REQUIRED';
  if (status === 'TRAINING_PENDING') return 'TRAINING_REQUIRED';
  if (status === 'VEHICLE_PENDING') return 'VEHICLE_REQUIRED';
  if (status === 'REVIEW_PENDING') return 'AUTHORISED_REVIEW_REQUIRED';
  return 'NONE';
}

interface ApplicationRow {
  application_id: string;
  driver_profile_id: string;
  status: DriverApplicationStatus;
  version: string | number;
  created_at: Date;
  updated_at: Date;
}

function applicationProjection(row: ApplicationRow): DriverApplicationProjection {
  return {
    applicationId: row.application_id,
    driverProfileId: row.driver_profile_id,
    status: row.status,
    version: Number(row.version),
    nextAction: nextAction(row.status),
    approvalGranted: row.status === 'APPROVED',
    operatingEligibilityGranted: false,
    externalVerificationConfigured: false,
    ocrMayApproveCompliance: false,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

async function readApplication(client: Pick<PoolClient, 'query'>, driverProfileId: string): Promise<ApplicationRow | null> {
  const result = await client.query<ApplicationRow>(
    `SELECT application_id, driver_profile_id, status, version, created_at, updated_at
       FROM driver.current_application_projection WHERE driver_profile_id = $1`,
    [driverProfileId]
  );
  return result.rows[0] ?? null;
}

export async function startOrResumeDriverApplication(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<DriverApplicationProjection> {
  if (!actor.driverProfileId) throw new DriverOperationsForbiddenError('A Driver profile is required');
  const requestFingerprint = fingerprint({ command: 'StartOrResumeDriverApplication', driverProfileId: actor.driverProfileId });
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    const profile = await client.query<{ onboarding_status: string; verified_contact_exists: boolean }>(
      `SELECT d.onboarding_status,
              EXISTS (
                SELECT 1 FROM identity.contact_point contact
                JOIN identity.verification_record verification ON verification.contact_point_id = contact.id
                 WHERE contact.user_account_id = $3 AND contact.status = 'ACTIVE'
                   AND verification.status = 'VERIFIED' AND verification.verified_at IS NOT NULL
              ) AS verified_contact_exists
         FROM driver.driver_profile d WHERE d.id = $1 AND d.person_id = $2 FOR UPDATE`,
      [actor.driverProfileId, actor.personId, actor.accountId]
    );
    if (!profile.rowCount) throw new DriverOperationsNotFoundError('Driver profile not found');

    // The profile row serialises same-Driver starts before the deduplication read. A retry that
    // waited behind the original command therefore returns the stored response instead of racing
    // the unique application or idempotency constraints.
    const existingCommand = await client.query<{ request_fingerprint: string; response_body: DriverApplicationProjection }>(
      `SELECT request_fingerprint, response_body FROM driver.command_deduplication
        WHERE command_type = 'StartOrResumeDriverApplication' AND driver_profile_id = $1 AND idempotency_key = $2`,
      [actor.driverProfileId, idempotencyKey]
    );
    if (existingCommand.rowCount) {
      const existing = existingCommand.rows[0]!;
      if (existing.request_fingerprint !== requestFingerprint) {
        throw new DriverOperationsIdempotencyConflictError('Idempotency key was already used for another Driver command');
      }
      await client.query('COMMIT');
      return existing.response_body;
    }
    let row = await readApplication(client, actor.driverProfileId);

    if (!row) {
      if (profile.rows[0]!.onboarding_status !== 'NOT_STARTED') {
        throw new DriverOperationsConflictError('Driver profile onboarding state has no matching application history');
      }
      const application = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO driver.driver_application (driver_profile_id, status, version, policy_version)
         VALUES ($1, 'STARTED', 1, $2) RETURNING id, created_at`,
        [actor.driverProfileId, APPLICATION_POLICY_VERSION]
      );
      const applicationId = application.rows[0]!.id;
      const correlationId = randomUUID();
      await client.query(
        `INSERT INTO driver.driver_application_transition
           (driver_application_id, from_status, to_status, version, command_id, actor_type, actor_id, reason_code)
         VALUES ($1, NULL, 'STARTED', 1, $2, 'DRIVER_SELF_SERVICE', $3, 'APPLICATION_STARTED')`,
        [applicationId, commandId, actor.personId]
      );
      await client.query(
        `INSERT INTO driver.outbox_message
           (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
         VALUES ('driver.application-started', 'DriverApplication', $1, 1, $2, $3, $4::jsonb)`,
        [applicationId, correlationId, commandId, JSON.stringify({ applicationId, driverProfileId: actor.driverProfileId })]
      );
      await client.query(
        `UPDATE driver.driver_profile SET onboarding_status = 'STARTED', updated_at = now() WHERE id = $1`,
        [actor.driverProfileId]
      );
      row = await readApplication(client, actor.driverProfileId);
    }

    if (row?.status === 'STARTED' && profile.rows[0]!.verified_contact_exists) {
      const contactCommandId = randomUUID();
      const correlationId = randomUUID();
      await client.query(
        `UPDATE driver.driver_application
            SET status = 'CONTACT_VERIFIED', version = 2, updated_at = now()
          WHERE id = $1`,
        [row.application_id]
      );
      await client.query(
        `INSERT INTO driver.driver_application_transition
           (driver_application_id, from_status, to_status, version, command_id, actor_type, actor_id, reason_code)
         VALUES ($1, 'STARTED', 'CONTACT_VERIFIED', 2, $2, 'SYSTEM', $3, 'AUTHORITATIVE_VERIFIED_CONTACT_AUTHENTICATOR')`,
        [row.application_id, contactCommandId, actor.personId]
      );
      await client.query(
        `INSERT INTO driver.outbox_message
           (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
         VALUES ('driver.application-contact-verified', 'DriverApplication', $1, 2, $2, $3, $4::jsonb)`,
        [row.application_id, correlationId, contactCommandId, JSON.stringify({ applicationId: row.application_id, driverProfileId: actor.driverProfileId })]
      );
      await client.query(
        `UPDATE driver.driver_profile SET onboarding_status = 'CONTACT_VERIFIED', updated_at = now() WHERE id = $1`,
        [actor.driverProfileId]
      );
      row = await readApplication(client, actor.driverProfileId);
    }

    if (!row) throw new DriverOperationsConflictError('Driver application could not be projected');
    const result = applicationProjection(row);
    await client.query(
      `INSERT INTO driver.command_deduplication
         (command_id, idempotency_key, command_type, driver_profile_id, request_fingerprint, response_status, response_body)
       VALUES ($1, $2, 'StartOrResumeDriverApplication', $3, $4, 200, $5::jsonb)`,
      [commandId, idempotencyKey, actor.driverProfileId, requestFingerprint, JSON.stringify(result)]
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCurrentDriverApplication(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<DriverApplicationProjection> {
  if (!actor.driverProfileId) throw new DriverOperationsForbiddenError('A Driver profile is required');
  const row = await readApplication(pool, actor.driverProfileId);
  if (!row) throw new DriverOperationsNotFoundError('Driver application has not been started');
  return applicationProjection(row);
}

export async function getDriverOperatingEligibilityProjection(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  regionCode: string,
  selectedVehicleId: string | null
): Promise<DriverOperatingEligibilityProjection> {
  if (!actor.driverProfileId) throw new DriverOperationsForbiddenError('A Driver profile is required');
  const profile = await pool.query<{ onboarding_status: string }>(
    'SELECT onboarding_status FROM driver.driver_profile WHERE id = $1 AND person_id = $2',
    [actor.driverProfileId, actor.personId]
  );
  if (!profile.rowCount) throw new DriverOperationsNotFoundError('Driver profile not found');

  const compliance = await pool.query<{ status: string; valid_until: Date }>(
    `SELECT status, valid_until FROM compliance.driver_eligibility_snapshot
      WHERE driver_profile_id = $1 ORDER BY evaluated_at DESC LIMIT 1`,
    [actor.driverProfileId]
  );
  const vehicle = selectedVehicleId ? await pool.query<{ authorised: boolean; status: string | null; valid_until: Date | null }>(
    `SELECT EXISTS (
              SELECT 1 FROM driver.driver_vehicle_authorisation a
               WHERE a.driver_profile_id = $1 AND a.vehicle_id = $2 AND a.status = 'ACTIVE'
                 AND a.valid_from <= now() AND (a.valid_until IS NULL OR a.valid_until > now())
            ) AS authorised,
            s.status, s.valid_until
       FROM (SELECT 1) seed
       LEFT JOIN LATERAL (
         SELECT status, valid_until FROM compliance.vehicle_eligibility_snapshot
          WHERE vehicle_id = $2 ORDER BY evaluated_at DESC LIMIT 1
       ) s ON true`,
    [actor.driverProfileId, selectedVehicleId]
  ) : null;
  const permissions = await pool.query<{ service_code: string }>(
    `SELECT p.service_code FROM driver.current_permission_projection p
      WHERE p.driver_profile_id = $1 AND p.region_code = $2
      ORDER BY p.service_code`,
    [actor.driverProfileId, regionCode]
  );
  const restrictions = await pool.query<{ scope: DriverRestrictionScope }>(
    `SELECT scope FROM driver.driver_restriction
      WHERE driver_profile_id = $1 AND status = 'ACTIVE' AND effective_from <= now()
        AND (effective_until IS NULL OR effective_until > now())
        AND (scope <> 'SPECIFIC_VEHICLE' OR vehicle_id = $2)
      ORDER BY scope`,
    [actor.driverProfileId, selectedVehicleId]
  );
  const now = new Date();
  const complianceRow = compliance.rows[0];
  const vehicleRow = vehicle?.rows[0];
  const decision = evaluateDriverOperatingEligibility({
    accountActive: actor.accountStatus === 'ACTIVE',
    driverApproved: profile.rows[0]!.onboarding_status === 'APPROVED',
    complianceCurrent: complianceRow?.status === 'ELIGIBLE' && complianceRow.valid_until.getTime() > now.getTime(),
    selectedVehiclePresent: Boolean(selectedVehicleId),
    selectedVehicleAuthorised: vehicleRow?.authorised ?? false,
    selectedVehicleEligible: vehicleRow?.status === 'ELIGIBLE' && Boolean(vehicleRow.valid_until && vehicleRow.valid_until.getTime() > now.getTime()),
    currentPermissionServiceCodes: permissions.rows.map((row) => row.service_code),
    activeRestrictionScopes: restrictions.rows.map((row) => row.scope)
  });
  return {
    driverProfileId: actor.driverProfileId,
    ...(selectedVehicleId ? { selectedVehicleId } : {}),
    status: decision.status,
    eligibleServiceCodes: decision.eligibleServiceCodes,
    activeRestrictionScopes: restrictions.rows.map((row) => row.scope),
    blockers: decision.blockers,
    availabilityEvaluatedSeparately: true,
    source: 'AUTHORITATIVE_CURRENT_PROJECTION',
    evaluatedAt: now.toISOString()
  };
}
