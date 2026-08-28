import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DatabasePool } from '../../db.js';
import { assertCanonicalForwardTransition, isQuoteUsable, type BookingStatus, type QuoteStatus } from '@dazat/domain';
import type {
  BookingQuoteResult,
  BookingSummary,
  ConfirmBookingResult,
  CreateRiderBookingRequest,
  LocationInput
} from '@dazat/contracts';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';
import type { PricingPort, PricedQuote } from './development-pricing-adapter.js';

export class BookingNotFoundError extends Error {}
export class BookingForbiddenError extends Error {}
export class BookingConflictError extends Error {}
export class QuoteNotUsableError extends Error {}

function validateLocation(location: LocationInput): void {
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }
  const label = location.displayLabel.trim();
  if (!label || label.length > 500) throw new Error('Location display label is required');
}

async function insertLocationSnapshot(client: PoolClient, location: LocationInput): Promise<string> {
  validateLocation(location);
  const result = await client.query<{ id: string }>(
    `INSERT INTO booking.location_snapshot
       (point, display_label, structured_address, provider_reference)
     VALUES (
       ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
       $3,
       $4::jsonb,
       $5
     )
     RETURNING id`,
    [
      location.longitude,
      location.latitude,
      location.displayLabel.trim(),
      JSON.stringify(location.structuredAddress ?? {}),
      location.providerReference ?? null
    ]
  );
  return result.rows[0]!.id;
}

async function readBookingSummary(client: Pick<PoolClient, 'query'>, bookingId: string): Promise<BookingSummary> {
  const result = await client.query<{
    id: string;
    status: string;
    aggregate_version: string | number;
    region_code: string;
    scheduled_for: Date | null;
    pickup_latitude: number;
    pickup_longitude: number;
    pickup_label: string;
    pickup_address: Record<string, string>;
    pickup_provider_reference: string | null;
    dropoff_latitude: number;
    dropoff_longitude: number;
    dropoff_label: string;
    dropoff_address: Record<string, string>;
    dropoff_provider_reference: string | null;
  }>(
    `SELECT b.id,
            b.status,
            b.aggregate_version,
            b.region_code,
            b.scheduled_for,
            ST_Y(pickup.point::geometry) AS pickup_latitude,
            ST_X(pickup.point::geometry) AS pickup_longitude,
            pickup.display_label AS pickup_label,
            pickup.structured_address AS pickup_address,
            pickup.provider_reference AS pickup_provider_reference,
            ST_Y(dropoff.point::geometry) AS dropoff_latitude,
            ST_X(dropoff.point::geometry) AS dropoff_longitude,
            dropoff.display_label AS dropoff_label,
            dropoff.structured_address AS dropoff_address,
            dropoff.provider_reference AS dropoff_provider_reference
       FROM booking.booking b
       JOIN booking.location_snapshot pickup ON pickup.id = b.pickup_snapshot_id
       JOIN booking.location_snapshot dropoff ON dropoff.id = b.dropoff_snapshot_id
      WHERE b.id = $1`,
    [bookingId]
  );
  if (!result.rowCount) throw new BookingNotFoundError('Booking not found');
  const row = result.rows[0]!;
  return {
    bookingId: row.id,
    status: row.status,
    aggregateVersion: Number(row.aggregate_version),
    regionCode: row.region_code,
    ...(row.scheduled_for ? { scheduledFor: row.scheduled_for.toISOString() } : {}),
    pickup: {
      latitude: Number(row.pickup_latitude),
      longitude: Number(row.pickup_longitude),
      displayLabel: row.pickup_label,
      structuredAddress: row.pickup_address,
      ...(row.pickup_provider_reference ? { providerReference: row.pickup_provider_reference } : {})
    },
    dropoff: {
      latitude: Number(row.dropoff_latitude),
      longitude: Number(row.dropoff_longitude),
      displayLabel: row.dropoff_label,
      structuredAddress: row.dropoff_address,
      ...(row.dropoff_provider_reference ? { providerReference: row.dropoff_provider_reference } : {})
    }
  };
}

async function assertBookingBooker(client: Pick<PoolClient, 'query'>, bookingId: string, personId: string): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM booking.booking_party
      WHERE booking_id = $1 AND role = 'BOOKER' AND person_id = $2
      LIMIT 1`,
    [bookingId, personId]
  );
  if (!result.rowCount) throw new BookingForbiddenError('Booking is not available to this actor');
}

async function transitionBooking(
  pool: DatabasePool,
  bookingId: string,
  expectedFrom: BookingStatus,
  to: BookingStatus,
  actor: AuthenticatedPrincipal,
  reasonCode: string,
  correlationId: string
): Promise<BookingSummary> {
  assertCanonicalForwardTransition(expectedFrom, to);
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    await assertBookingBooker(client, bookingId, actor.personId);
    const locked = await client.query<{ status: BookingStatus; aggregate_version: string | number }>(
      `SELECT status, aggregate_version FROM booking.booking WHERE id = $1 FOR UPDATE`,
      [bookingId]
    );
    if (!locked.rowCount) throw new BookingNotFoundError('Booking not found');
    const current = locked.rows[0]!;
    if (current.status !== expectedFrom) {
      throw new BookingConflictError(`Expected Booking ${expectedFrom}; found ${current.status}`);
    }
    const nextVersion = Number(current.aggregate_version) + 1;
    await client.query(
      `UPDATE booking.booking
          SET status = $2::booking.booking_status, aggregate_version = $3, updated_at = now()
        WHERE id = $1`,
      [bookingId, to, nextVersion]
    );
    await client.query(
      `INSERT INTO booking.booking_state_transition
         (booking_id, from_status, to_status, aggregate_version, command_id, actor_type, actor_id, reason_code)
       VALUES ($1, $2::booking.booking_status, $3::booking.booking_status, $4, $5, 'ACCOUNT', $6, $7)`,
      [bookingId, expectedFrom, to, nextVersion, commandId, actor.accountId, reasonCode]
    );
    await client.query(
      `INSERT INTO booking.outbox_message
         (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
       VALUES ('Booking', $1, $2, $3, $4, $5, $6::jsonb)`,
      [
        bookingId,
        nextVersion,
        `booking.${to.toLowerCase()}`,
        correlationId,
        commandId,
        JSON.stringify({ bookingId, from: expectedFrom, to, aggregateVersion: nextVersion })
      ]
    );
    const summary = await readBookingSummary(client, bookingId);
    await client.query('COMMIT');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createRiderBooking(
  pool: DatabasePool,
  request: CreateRiderBookingRequest,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<BookingSummary> {
  if (!actor.riderProfileId) throw new BookingForbiddenError('A Rider profile is required to create a Rider booking');
  validateLocation(request.pickup);
  validateLocation(request.dropoff);
  const regionCode = request.regionCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(regionCode)) throw new Error('Invalid region code');
  const scheduledFor = request.scheduledFor ? new Date(request.scheduledFor) : null;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) throw new Error('Invalid scheduledFor timestamp');

  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');

    const existing = await client.query<{ response_body: unknown }>(
      `SELECT response_body FROM booking.command_deduplication
        WHERE command_type = 'CreateRiderBooking' AND idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return existing.rows[0]!.response_body as BookingSummary;
    }

    const rider = await client.query(
      `SELECT 1 FROM rider.rider_profile WHERE id = $1 AND person_id = $2 AND status IN ('ACTIVE','LIMITED')`,
      [actor.riderProfileId, actor.personId]
    );
    if (!rider.rowCount) throw new BookingForbiddenError('Rider profile is not eligible to create a booking');

    const pickupId = await insertLocationSnapshot(client, request.pickup);
    const dropoffId = await insertLocationSnapshot(client, request.dropoff);
    const booking = await client.query<{ id: string }>(
      `INSERT INTO booking.booking
         (status, pickup_snapshot_id, dropoff_snapshot_id, scheduled_for, region_code, aggregate_version)
       VALUES ('DRAFT', $1, $2, $3, $4, 1)
       RETURNING id`,
      [pickupId, dropoffId, scheduledFor?.toISOString() ?? null, regionCode]
    );
    const bookingId = booking.rows[0]!.id;

    for (const role of ['BOOKER', 'PASSENGER', 'PAYER'] as const) {
      await client.query(
        `INSERT INTO booking.booking_party (booking_id, role, person_id)
         VALUES ($1, $2::booking.booking_party_role, $3)`,
        [bookingId, role, actor.personId]
      );
    }

    for (const requirement of request.requirements ?? []) {
      const type = requirement.type.trim();
      if (!type || type.length > 100) throw new Error('Booking requirement type is invalid');
      await client.query(
        `INSERT INTO booking.booking_requirement
           (booking_id, requirement_type, requirement_value, source)
         VALUES ($1, $2, $3::jsonb, 'BOOKER')`,
        [bookingId, type, JSON.stringify(requirement.value)]
      );
    }

    await client.query(
      `INSERT INTO booking.booking_state_transition
         (booking_id, from_status, to_status, aggregate_version, command_id, actor_type, actor_id, reason_code)
       VALUES ($1, NULL, 'DRAFT', 1, $2, 'ACCOUNT', $3, 'RIDER_BOOKING_CREATED')`,
      [bookingId, commandId, actor.accountId]
    );
    await client.query(
      `INSERT INTO booking.outbox_message
         (aggregate_type, aggregate_id, aggregate_version, event_type, correlation_id, causation_id, payload)
       VALUES ('Booking', $1, 1, 'booking.created', $2, $3, $4::jsonb)`,
      [bookingId, correlationId, commandId, JSON.stringify({ bookingId, regionCode, actorAccountId: actor.accountId })]
    );

    const summary = await readBookingSummary(client, bookingId);
    await client.query(
      `INSERT INTO booking.command_deduplication
         (command_id, idempotency_key, command_type, booking_id, response_status, response_body)
       VALUES ($1, $2, 'CreateRiderBooking', $3, 201, $4::jsonb)`,
      [commandId, idempotencyKey, bookingId, JSON.stringify(summary)]
    );
    await client.query('COMMIT');
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function persistQuote(
  pool: DatabasePool,
  bookingId: string,
  priced: PricedQuote,
  idempotencyKey: string,
  correlationId: string
): Promise<string> {
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ response_body: { quoteId?: string } }>(
      `SELECT response_body FROM pricing.command_deduplication
        WHERE command_type = 'CreateBookingQuote' AND idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.rowCount && existing.rows[0]!.response_body.quoteId) {
      await client.query('COMMIT');
      return existing.rows[0]!.response_body.quoteId!;
    }

    await client.query(
      `UPDATE pricing.quote SET status = 'SUPERSEDED'
        WHERE booking_id = $1 AND status = 'OFFERED'`,
      [bookingId]
    );
    const quote = await client.query<{ id: string }>(
      `INSERT INTO pricing.quote
         (booking_id, status, amount_minor, currency, policy_version, source_mode, expires_at)
       VALUES ($1, 'OFFERED', $2, $3, $4, $5, $6)
       RETURNING id`,
      [bookingId, priced.amountMinor, priced.currency, priced.policyVersion, priced.sourceMode, priced.expiresAt.toISOString()]
    );
    const quoteId = quote.rows[0]!.id;
    await client.query(
      `INSERT INTO pricing.outbox_message
         (aggregate_type, aggregate_id, event_type, correlation_id, causation_id, payload)
       VALUES ('Quote', $1, 'pricing.quote.created', $2, $3, $4::jsonb)`,
      [quoteId, correlationId, commandId, JSON.stringify({ quoteId, bookingId, policyVersion: priced.policyVersion })]
    );
    await client.query(
      `INSERT INTO pricing.command_deduplication
         (command_id, idempotency_key, command_type, booking_id, response_status, response_body)
       VALUES ($1, $2, 'CreateBookingQuote', $3, 201, $4::jsonb)`,
      [commandId, idempotencyKey, bookingId, JSON.stringify({ quoteId })]
    );
    await client.query('COMMIT');
    return quoteId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function quoteRiderBooking(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal,
  pricing: PricingPort,
  idempotencyKey: string
): Promise<BookingQuoteResult> {
  const client = await pool.connect();
  let booking: BookingSummary;
  try {
    await assertBookingBooker(client, bookingId, actor.personId);
    const deduplicated = await client.query<{ response_body: BookingQuoteResult }>(
      `SELECT response_body FROM booking.command_deduplication
        WHERE command_type = 'QuoteRiderBooking' AND idempotency_key = $1 AND booking_id = $2`,
      [idempotencyKey, bookingId]
    );
    if (deduplicated.rowCount) return deduplicated.rows[0]!.response_body;
    booking = await readBookingSummary(client, bookingId);
  } finally {
    client.release();
  }
  if (booking.status !== 'DRAFT') throw new BookingConflictError(`Booking is ${booking.status}, not DRAFT`);

  // Provider/policy work is deliberately outside a Booking database transaction.
  const priced = await pricing.createQuote({
    bookingId,
    regionCode: booking.regionCode,
    ...(booking.scheduledFor ? { scheduledFor: new Date(booking.scheduledFor) } : {})
  });
  const correlationId = randomUUID();
  const quoteId = await persistQuote(pool, bookingId, priced, idempotencyKey, correlationId);
  await transitionBooking(pool, bookingId, 'DRAFT', 'QUOTE_CREATED', actor, 'QUOTE_CREATED', correlationId);
  const updated = await transitionBooking(pool, bookingId, 'QUOTE_CREATED', 'AWAITING_CONFIRMATION', actor, 'QUOTE_PRESENTED', correlationId);

  const response: BookingQuoteResult = {
    booking: updated,
    quote: {
      quoteId,
      status: 'OFFERED',
      amountMinor: priced.amountMinor,
      currency: priced.currency,
      policyVersion: priced.policyVersion,
      expiresAt: priced.expiresAt.toISOString(),
      nonCommercialDevelopmentFixture: priced.nonCommercialDevelopmentFixture
    }
  };
  await pool.query(
    `INSERT INTO booking.command_deduplication
       (command_id, idempotency_key, command_type, booking_id, response_status, response_body)
     VALUES ($1, $2, 'QuoteRiderBooking', $3, 201, $4::jsonb)
     ON CONFLICT (command_type, idempotency_key) DO NOTHING`,
    [randomUUID(), idempotencyKey, bookingId, JSON.stringify(response)]
  );
  return response;
}

async function acceptQuote(
  pool: DatabasePool,
  bookingId: string,
  quoteId: string,
  idempotencyKey: string,
  correlationId: string
): Promise<ConfirmBookingResult['fareAgreement']> {
  const client = await pool.connect();
  const commandId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ response_body: ConfirmBookingResult['fareAgreement'] }>(
      `SELECT response_body FROM pricing.command_deduplication
        WHERE command_type = 'AcceptBookingQuote' AND idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }

    const quote = await client.query<{
      id: string;
      booking_id: string;
      status: QuoteStatus;
      amount_minor: string | number;
      currency: string;
      policy_version: string;
      expires_at: Date;
    }>(
      `SELECT id, booking_id, status, amount_minor, currency, policy_version, expires_at
         FROM pricing.quote
        WHERE id = $1 AND booking_id = $2
        FOR UPDATE`,
      [quoteId, bookingId]
    );
    if (!quote.rowCount) throw new QuoteNotUsableError('Quote not found for Booking');
    const row = quote.rows[0]!;
    if (!isQuoteUsable(row.status, row.expires_at)) {
      if (row.status === 'OFFERED' && row.expires_at.getTime() <= Date.now()) {
        await client.query(`UPDATE pricing.quote SET status = 'EXPIRED' WHERE id = $1`, [row.id]);
      }
      throw new QuoteNotUsableError('Quote is expired or no longer offered');
    }

    const agreement = await client.query<{ id: string; agreed_at: Date }>(
      `INSERT INTO pricing.fare_agreement
         (booking_id, quote_id, amount_minor, currency, policy_version)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, agreed_at`,
      [bookingId, quoteId, row.amount_minor, row.currency, row.policy_version]
    );
    await client.query(`UPDATE pricing.quote SET status = 'ACCEPTED', accepted_at = now() WHERE id = $1`, [quoteId]);
    const fareAgreement = {
      fareAgreementId: agreement.rows[0]!.id,
      quoteId,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      policyVersion: row.policy_version,
      agreedAt: agreement.rows[0]!.agreed_at.toISOString()
    };
    await client.query(
      `INSERT INTO pricing.outbox_message
         (aggregate_type, aggregate_id, event_type, correlation_id, causation_id, payload)
       VALUES ('FareAgreement', $1, 'pricing.fare_agreement.created', $2, $3, $4::jsonb)`,
      [fareAgreement.fareAgreementId, correlationId, commandId, JSON.stringify({ bookingId, quoteId, fareAgreementId: fareAgreement.fareAgreementId })]
    );
    await client.query(
      `INSERT INTO pricing.command_deduplication
         (command_id, idempotency_key, command_type, booking_id, response_status, response_body)
       VALUES ($1, $2, 'AcceptBookingQuote', $3, 201, $4::jsonb)`,
      [commandId, idempotencyKey, bookingId, JSON.stringify(fareAgreement)]
    );
    await client.query('COMMIT');
    return fareAgreement;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmRiderBooking(
  pool: DatabasePool,
  bookingId: string,
  quoteId: string,
  actor: AuthenticatedPrincipal,
  idempotencyKey: string
): Promise<ConfirmBookingResult> {
  const checkClient = await pool.connect();
  let before: BookingSummary;
  try {
    await assertBookingBooker(checkClient, bookingId, actor.personId);
    const deduplicated = await checkClient.query<{ response_body: ConfirmBookingResult }>(
      `SELECT response_body FROM booking.command_deduplication
        WHERE command_type = 'ConfirmRiderBooking' AND idempotency_key = $1 AND booking_id = $2`,
      [idempotencyKey, bookingId]
    );
    if (deduplicated.rowCount) return deduplicated.rows[0]!.response_body;
    before = await readBookingSummary(checkClient, bookingId);
  } finally {
    checkClient.release();
  }
  if (before.status !== 'AWAITING_CONFIRMATION') {
    throw new BookingConflictError(`Booking is ${before.status}, not AWAITING_CONFIRMATION`);
  }

  const correlationId = randomUUID();
  const fareAgreement = await acceptQuote(pool, bookingId, quoteId, idempotencyKey, correlationId);
  await transitionBooking(pool, bookingId, 'AWAITING_CONFIRMATION', 'CONFIRMED', actor, 'RIDER_CONFIRMED_QUOTE', correlationId);

  const now = Date.now();
  const scheduledFor = before.scheduledFor ? new Date(before.scheduledFor).getTime() : null;
  const nextStatus: BookingStatus = scheduledFor && scheduledFor > now ? 'SCHEDULED' : 'READY_FOR_DISPATCH';
  const booking = await transitionBooking(pool, bookingId, 'CONFIRMED', nextStatus, actor, 'BOOKING_DISPATCH_READINESS_CLASSIFIED', correlationId);
  const response: ConfirmBookingResult = { booking, fareAgreement };
  await pool.query(
    `INSERT INTO booking.command_deduplication
       (command_id, idempotency_key, command_type, booking_id, response_status, response_body)
     VALUES ($1, $2, 'ConfirmRiderBooking', $3, 200, $4::jsonb)
     ON CONFLICT (command_type, idempotency_key) DO NOTHING`,
    [randomUUID(), idempotencyKey, bookingId, JSON.stringify(response)]
  );
  return response;
}

export async function getRiderBooking(
  pool: DatabasePool,
  bookingId: string,
  actor: AuthenticatedPrincipal
): Promise<BookingSummary> {
  const client = await pool.connect();
  try {
    await assertBookingBooker(client, bookingId, actor.personId);
    return await readBookingSummary(client, bookingId);
  } finally {
    client.release();
  }
}
