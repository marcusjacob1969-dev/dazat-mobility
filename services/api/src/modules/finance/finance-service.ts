import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DriverEarningsProjection, PaymentStatusProjection, PreparePaymentIntentResult, ReceiptProjection } from '@dazat/contracts';
import type { PaymentStatus } from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class FinanceNotFoundError extends Error {}
export class FinanceForbiddenError extends Error {}
export class FinanceConflictError extends Error {}
export class FinanceIdempotencyConflictError extends Error {}
export class ReceiptNotReadyError extends Error {}

const CHARGING_DISABLED_GUIDANCE = 'Production charging is disabled. No provider action was attempted.';

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function assertBookingPayer(
  client: Pick<PoolClient, 'query'>,
  bookingId: string,
  personId: string
): Promise<void> {
  const booking = await client.query('SELECT 1 FROM booking.booking WHERE id = $1', [bookingId]);
  if (!booking.rowCount) throw new FinanceNotFoundError('Booking not found');
  const payer = await client.query(
    `SELECT 1 FROM booking.booking_party
      WHERE booking_id = $1 AND role = 'PAYER' AND person_id = $2
      LIMIT 1`,
    [bookingId, personId]
  );
  if (!payer.rowCount) throw new FinanceForbiddenError('Financial history is not available to this actor');
}

export async function preparePaymentIntent(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<PreparePaymentIntentResult> {
  if (!actor.riderProfileId) throw new FinanceForbiddenError('A Rider profile is required');
  const requestFingerprint = fingerprint({ command: 'PreparePaymentIntent', bookingId, actorId: actor.personId });
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    await assertBookingPayer(client, bookingId, actor.personId);

    const existingCommand = await client.query<{ request_fingerprint: string; response_body: PreparePaymentIntentResult }>(
      `SELECT request_fingerprint, response_body
         FROM finance.command_deduplication
        WHERE command_type = 'PreparePaymentIntent'
          AND actor_id = $1 AND scope_reference_id = $2 AND idempotency_key = $3`,
      [actor.personId, bookingId, idempotencyKey]
    );
    if (existingCommand.rowCount) {
      const existing = existingCommand.rows[0]!;
      if (existing.request_fingerprint !== requestFingerprint) {
        throw new FinanceIdempotencyConflictError('Idempotency key was already used for another request');
      }
      await client.query('COMMIT');
      return existing.response_body;
    }

    const source = await client.query<{
      booking_status: string;
      fare_agreement_id: string;
      amount_minor: string | number;
      currency: string;
    }>(
      `SELECT b.status AS booking_status,
              fa.id AS fare_agreement_id,
              fa.amount_minor,
              fa.currency
         FROM booking.booking b
         LEFT JOIN pricing.fare_agreement fa ON fa.booking_id = b.id
        WHERE b.id = $1
        FOR UPDATE OF b`,
      [bookingId]
    );
    const row = source.rows[0]!;
    if (row.booking_status !== 'COMPLETED') {
      throw new FinanceConflictError('Payment intent preparation requires a governed COMPLETED Booking');
    }
    if (!row.fare_agreement_id) throw new FinanceConflictError('An immutable FareAgreement is required');
    const amountMinor = Number(row.amount_minor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new FinanceConflictError('FareAgreement money is invalid');

    const existingIntent = await client.query<{
      id: string; fare_agreement_id: string; amount_minor: string | number; currency: string; status: string;
      charging_eligibility: 'NOT_ELIGIBLE' | 'APPROVED_POLICY'; created_at: Date;
    }>(
      `SELECT id, fare_agreement_id, amount_minor, currency, status, charging_eligibility, created_at
         FROM finance.payment_intent
        WHERE booking_id = $1 AND status = 'CREATED'
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [bookingId]
    );

    let intent: {
      id: string; fare_agreement_id: string; amount_minor: string | number; currency: string; status: string;
      charging_eligibility: 'NOT_ELIGIBLE' | 'APPROVED_POLICY'; created_at: Date;
    };
    if (existingIntent.rowCount) {
      intent = existingIntent.rows[0]!;
      if (intent.fare_agreement_id !== row.fare_agreement_id || Number(intent.amount_minor) !== amountMinor || intent.currency !== row.currency) {
        throw new FinanceConflictError('Existing PaymentIntent does not match the FareAgreement');
      }
    } else {
      const inserted = await client.query<typeof intent>(
        `INSERT INTO finance.payment_intent
           (booking_id, fare_agreement_id, payer_person_id, amount_minor, currency, status,
            charging_eligibility, provider_action_attempted, reconciliation_required)
         VALUES ($1, $2, $3, $4, $5, 'CREATED', 'NOT_ELIGIBLE', false, false)
         RETURNING id, fare_agreement_id, amount_minor, currency, status, charging_eligibility, created_at`,
        [bookingId, row.fare_agreement_id, actor.personId, amountMinor, row.currency]
      );
      intent = inserted.rows[0]!;
      await client.query(
        `INSERT INTO finance.payment_intent_transition
           (payment_intent_id, from_status, to_status, aggregate_version, command_id, reason_code, actor_type, actor_id)
         VALUES ($1, NULL, 'CREATED', 1, $2, 'PROVIDER_NEUTRAL_INTENT_PREPARED', 'ACCOUNT', $3)`,
        [intent.id, commandId, actor.accountId]
      );
    }

    if (intent.charging_eligibility !== 'NOT_ELIGIBLE') {
      throw new FinanceConflictError('An approved PaymentIntent cannot be returned through the provider-disabled preparation path');
    }

    const result: PreparePaymentIntentResult = {
      paymentIntentId: intent.id,
      bookingId,
      fareAgreementId: intent.fare_agreement_id,
      amountMinor: Number(intent.amount_minor),
      currency: intent.currency,
      status: 'CREATED',
      chargingEligibility: intent.charging_eligibility,
      providerActionAttempted: false,
      productionChargingEnabled: false,
      nextAction: 'PROVIDER_CONFIGURATION_REQUIRED',
      blindRetryAllowed: false,
      createdAt: intent.created_at.toISOString()
    };
    await client.query(
      `INSERT INTO finance.command_deduplication
         (command_id, idempotency_key, command_type, actor_id, scope_reference_id,
          request_fingerprint, response_status, response_body)
       VALUES ($1, $2, 'PreparePaymentIntent', $3, $4, $5, 201, $6::jsonb)`,
      [commandId, idempotencyKey, actor.personId, bookingId, requestFingerprint, JSON.stringify(result)]
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

export async function getPaymentStatus(
  pool: DatabasePool,
  paymentIntentId: string,
  actor: AuthenticatedPrincipal
): Promise<PaymentStatusProjection> {
  const result = await pool.query<{
    payment_intent_id: string; booking_id: string; payer_person_id: string; amount_minor: string | number;
    currency: string; status: PaymentStatus; charging_eligibility: 'NOT_ELIGIBLE' | 'APPROVED_POLICY';
    provider_action_attempted: boolean; reconciliation_required: boolean; updated_at: Date;
  }>(
    `SELECT payment_intent_id, booking_id, payer_person_id, amount_minor, currency, status, charging_eligibility,
            provider_action_attempted, reconciliation_required, updated_at
       FROM finance.payment_status_projection WHERE payment_intent_id = $1`,
    [paymentIntentId]
  );
  if (!result.rowCount) throw new FinanceNotFoundError('PaymentIntent not found');
  const row = result.rows[0]!;
  if (row.payer_person_id !== actor.personId) throw new FinanceForbiddenError('Payment status is not available to this actor');
  const reconciliationRequired = row.status === 'STATUS_UNKNOWN' || row.reconciliation_required;
  return {
    paymentIntentId: row.payment_intent_id,
    bookingId: row.booking_id,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    chargingEligibility: row.charging_eligibility,
    productionChargingEnabled: false,
    providerActionAttempted: row.provider_action_attempted,
    reconciliationRequired,
    blindRetryAllowed: false,
    guidance: reconciliationRequired
      ? 'Do not retry. DAZAT must reconcile provider state before any further payment action.'
      : CHARGING_DISABLED_GUIDANCE,
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getReceiptByBooking(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal
): Promise<ReceiptProjection> {
  await assertBookingPayer(pool, bookingId, actor.personId);
  const result = await pool.query<{
    payment_id: string; booking_id: string; captured_amount_minor: string | number;
    refunded_amount_minor: string | number; currency: string; captured_at: Date;
  }>(
    `SELECT p.id AS payment_id,
            pi.booking_id,
            p.captured_amount_minor,
            p.refunded_amount_minor,
            p.currency,
            COALESCE(p.provider_created_at, p.updated_at) AS captured_at
       FROM finance.payment p
       JOIN finance.payment_intent pi ON pi.id = p.payment_intent_id
      WHERE pi.booking_id = $1 AND p.captured_amount_minor > 0
      ORDER BY captured_at DESC LIMIT 1`,
    [bookingId]
  );
  if (!result.rowCount) throw new ReceiptNotReadyError('No captured Payment exists; a receipt cannot be issued');
  const row = result.rows[0]!;
  return {
    receiptId: row.payment_id,
    bookingId: row.booking_id,
    paymentId: row.payment_id,
    capturedAmountMinor: Number(row.captured_amount_minor),
    refundedAmountMinor: Number(row.refunded_amount_minor),
    currency: row.currency,
    capturedAt: row.captured_at.toISOString()
  };
}

export async function getDriverEarnings(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<DriverEarningsProjection> {
  if (!actor.driverProfileId) throw new FinanceForbiddenError('A Driver profile is required');
  const rows = await pool.query<{
    driver_earning_id: string; booking_id: string; journey_id: string; amount_minor: string | number;
    currency: string; status: 'POSTED' | 'ADJUSTED' | 'REVERSED'; posted_at: Date;
  }>(
    `SELECT driver_earning_id, booking_id, journey_id, amount_minor, currency, status, posted_at
       FROM finance.driver_earnings_projection
      WHERE driver_profile_id = $1 ORDER BY posted_at DESC, driver_earning_id DESC`,
    [actor.driverProfileId]
  );
  return {
    earnings: rows.rows.map((row) => ({
      driverEarningId: row.driver_earning_id,
      bookingId: row.booking_id,
      journeyId: row.journey_id,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      status: row.status,
      postedAt: row.posted_at.toISOString()
    })),
    payoutDerivedFromEarnings: false,
    riderFareUsedAsDriverEarning: false
  };
}
