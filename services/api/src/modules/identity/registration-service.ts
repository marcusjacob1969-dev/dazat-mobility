import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabasePool } from '../../db.js';
import { maskContact, normaliseContact, profileKinds } from '@dazat/domain';
import type {
  AccountRegistrationResult,
  RegistrationContactType,
  StartAccountRegistrationRequest
} from '@dazat/contracts';

const COMMAND_TYPE = 'StartAccountRegistration';

export interface RegistrationContext {
  readonly idempotencyKey: string;
  readonly actorIpHash?: string;
}

interface RegistrationIds {
  readonly personId: string;
  readonly accountId: string;
  readonly contactPointId: string;
  readonly riderProfileId?: string;
  readonly driverProfileId?: string;
}

function asRegistrationResult(value: unknown): AccountRegistrationResult {
  if (!value || typeof value !== 'object') throw new Error('Stored registration response is invalid');
  return value as AccountRegistrationResult;
}

async function findDeduplicatedResult(
  client: PoolClient,
  idempotencyKey: string
): Promise<AccountRegistrationResult | null> {
  const result = await client.query<{ response_body: unknown }>(
    `SELECT response_body
       FROM identity.command_deduplication
      WHERE command_type = $1 AND idempotency_key = $2`,
    [COMMAND_TYPE, idempotencyKey]
  );
  if (!result.rowCount) return null;
  return asRegistrationResult(result.rows[0]?.response_body);
}

async function createIdentityRecords(
  client: PoolClient,
  request: StartAccountRegistrationRequest,
  commandId: string,
  correlationId: string
): Promise<{ ids: RegistrationIds; result: AccountRegistrationResult }> {
  const preferredName = request.preferredName.trim();
  if (preferredName.length < 1 || preferredName.length > 100) {
    throw new Error('Preferred name must be between 1 and 100 characters');
  }

  const contactType: RegistrationContactType = request.contact.type;
  const normalizedContact = normaliseContact(contactType, request.contact.value);
  const displayHint = maskContact(contactType, normalizedContact);

  const person = await client.query<{ id: string }>(
    'INSERT INTO identity.person DEFAULT VALUES RETURNING id'
  );
  const personId = person.rows[0]!.id;

  await client.query(
    `INSERT INTO identity.person_name (person_id, name_type, value)
     VALUES ($1, 'PREFERRED', $2)`,
    [personId, preferredName]
  );

  const account = await client.query<{ id: string }>(
    `INSERT INTO identity.user_account (person_id, status)
     VALUES ($1, 'PENDING') RETURNING id`,
    [personId]
  );
  const accountId = account.rows[0]!.id;

  const contact = await client.query<{ id: string }>(
    `INSERT INTO identity.contact_point
       (person_id, user_account_id, type, normalized_value, display_hint)
     VALUES ($1, $2, $3::identity.contact_point_type, $4, $5)
     RETURNING id`,
    [personId, accountId, contactType, normalizedContact, displayHint]
  );
  const contactPointId = contact.rows[0]!.id;

  let riderProfileId: string | undefined;
  let driverProfileId: string | undefined;
  for (const profile of profileKinds(request.profileKind)) {
    if (profile === 'RIDER') {
      const rider = await client.query<{ id: string }>(
        `INSERT INTO rider.rider_profile (person_id, status)
         VALUES ($1, 'ACTIVE') RETURNING id`,
        [personId]
      );
      riderProfileId = rider.rows[0]!.id;
    } else {
      const driver = await client.query<{ id: string }>(
        `INSERT INTO driver.driver_profile (person_id, onboarding_status, operating_status)
         VALUES ($1, 'NOT_STARTED', 'OFFLINE') RETURNING id`,
        [personId]
      );
      driverProfileId = driver.rows[0]!.id;
    }
  }

  await client.query(
    `INSERT INTO identity.account_status_transition
       (user_account_id, from_status, to_status, command_id, reason_code, actor_type)
     VALUES ($1, NULL, 'PENDING', $2, 'REGISTRATION_STARTED', 'SELF_SERVICE')`,
    [accountId, commandId]
  );

  const result: AccountRegistrationResult = {
    accountId,
    ...(riderProfileId ? { riderProfileId } : {}),
    ...(driverProfileId ? { driverProfileId } : {}),
    accountStatus: 'PENDING',
    nextAction: 'CONTACT_VERIFICATION_REQUIRED',
    contact: {
      id: contactPointId,
      type: contactType,
      displayHint,
      verificationStatus: 'UNVERIFIED'
    }
  };

  // Event payload intentionally excludes the raw/normalised contact value.
  await client.query(
    `INSERT INTO identity.outbox_message
       (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
     VALUES ('UserAccount', $1, 1, 'identity.account.registration_started', $2, $3, $4::jsonb)`,
    [
      accountId,
      correlationId,
      commandId,
      JSON.stringify({
        accountId,
        profileKind: request.profileKind,
        contactPointId,
        contactType,
        nextAction: result.nextAction
      })
    ]
  );

  return {
    ids: {
      personId,
      accountId,
      contactPointId,
      ...(riderProfileId ? { riderProfileId } : {}),
      ...(driverProfileId ? { driverProfileId } : {})
    },
    result
  };
}

export async function startAccountRegistration(
  pool: DatabasePool,
  request: StartAccountRegistrationRequest,
  context: RegistrationContext
): Promise<AccountRegistrationResult> {
  const commandId = randomUUID();
  const correlationId = randomUUID();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await findDeduplicatedResult(client, context.idempotencyKey);
    if (existing) {
      await client.query('COMMIT');
      return existing;
    }

    const { result } = await createIdentityRecords(client, request, commandId, correlationId);

    await client.query(
      `INSERT INTO identity.command_deduplication
         (command_id, idempotency_key, command_type, response_status, response_body)
       VALUES ($1, $2, $3, 202, $4::jsonb)`,
      [commandId, context.idempotencyKey, COMMAND_TYPE, JSON.stringify(result)]
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
