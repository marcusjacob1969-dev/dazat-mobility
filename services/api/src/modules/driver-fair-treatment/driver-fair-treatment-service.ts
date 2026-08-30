import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  DriverAppealSummary,
  DriverComplaintSummary,
  DriverFairTreatmentProjection,
  DriverIncentiveProjection,
  DriverRestrictionSummary,
  RiderConductCaseProjection,
  SubmitDriverAppealProjection,
  SubmitDriverAppealRequest,
  SubmitRiderConductReportRequest,
  UnsafeJourneyTerminationProjection
} from '@dazat/contracts';
import {
  DRIVER_APPEAL_SUBJECT_TYPES,
  RIDER_CONDUCT_CATEGORIES,
  driverMayEnterBreakAfterUnsafeTermination,
  unsafeJourneyTerminationMayProceed
} from '@dazat/domain';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class DriverFairTreatmentNotFoundError extends Error {}
export class DriverFairTreatmentForbiddenError extends Error {}
export class DriverFairTreatmentConflictError extends Error {}
export class DriverFairTreatmentIdempotencyConflictError extends Error {}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

interface FairTreatmentRow {
  driver_profile_id: string;
  rating_count: string | number;
  average_rating: string | number | null;
  open_complaint_count: string | number;
  substantiated_finding_count: string | number;
  active_restriction_count: string | number;
  open_appeal_count: string | number;
  open_rider_conduct_case_count: string | number;
}

export async function getDriverFairTreatmentProjection(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal
): Promise<DriverFairTreatmentProjection> {
  if (!actor.driverProfileId) throw new DriverFairTreatmentForbiddenError('A Driver profile is required');
  const summary = await pool.query<FairTreatmentRow>(
    `SELECT driver_profile_id, rating_count, average_rating, open_complaint_count,
            substantiated_finding_count, active_restriction_count, open_appeal_count,
            open_rider_conduct_case_count
       FROM driver.current_driver_fair_treatment_projection
      WHERE driver_profile_id = $1`,
    [actor.driverProfileId]
  );
  if (!summary.rowCount) throw new DriverFairTreatmentNotFoundError('Driver fair-treatment projection not found');

  const [complaints, restrictions, appeals] = await Promise.all([
    pool.query<{
      complaint_id: string;
      category: DriverComplaintSummary['category'];
      status: DriverComplaintSummary['status'];
      response_opportunity_provided: boolean;
      driver_response_due_at: Date | null;
      finding: DriverComplaintSummary['finding'] | null;
    }>(
      `SELECT complaint.id AS complaint_id, complaint.allegation_category AS category,
              complaint.status, complaint.response_opportunity_provided,
              complaint.driver_response_due_at, finding.finding
         FROM driver.driver_complaint complaint
         LEFT JOIN driver.driver_complaint_finding finding ON finding.driver_complaint_id = complaint.id
        WHERE complaint.driver_profile_id = $1
        ORDER BY complaint.created_at DESC LIMIT 100`,
      [actor.driverProfileId]
    ),
    pool.query<{
      restriction_id: string;
      scope: string;
      precautionary: boolean;
      restriction_basis: DriverRestrictionSummary['restrictionBasis'];
      review_due_at: Date | null;
    }>(
      `SELECT id AS restriction_id, scope, precautionary, restriction_basis, review_due_at
         FROM driver.driver_restriction
        WHERE driver_profile_id = $1 AND status = 'ACTIVE' AND effective_from <= now()
          AND (effective_until IS NULL OR effective_until > now())
        ORDER BY effective_from DESC`,
      [actor.driverProfileId]
    ),
    pool.query<{
      appeal_id: string;
      subject_type: DriverAppealSummary['subjectType'];
      subject_id: string;
      status: DriverAppealSummary['status'];
      submitted_at: Date;
    }>(
      `SELECT id AS appeal_id, subject_type, subject_id, status, submitted_at
         FROM driver.driver_decision_appeal
        WHERE driver_profile_id = $1 ORDER BY submitted_at DESC LIMIT 100`,
      [actor.driverProfileId]
    )
  ]);

  const row = summary.rows[0]!;
  return {
    driverProfileId: actor.driverProfileId,
    dimensions: {
      ratingFeedbackCount: Number(row.rating_count),
      ...(row.average_rating === null ? {} : { averageRating: Number(row.average_rating) }),
      openComplaintCount: Number(row.open_complaint_count),
      substantiatedFindingCount: Number(row.substantiated_finding_count),
      activeRestrictionCount: Number(row.active_restriction_count),
      openAppealCount: Number(row.open_appeal_count),
      openRiderConductCaseCount: Number(row.open_rider_conduct_case_count)
    },
    complaints: complaints.rows.map((complaint) => ({
      complaintId: complaint.complaint_id,
      category: complaint.category,
      status: complaint.status,
      responseOpportunityProvided: complaint.response_opportunity_provided,
      ...(complaint.driver_response_due_at ? { responseDueAt: complaint.driver_response_due_at.toISOString() } : {}),
      ...(complaint.finding ? { finding: complaint.finding } : {}),
      allegationIsFinding: false
    })),
    restrictions: restrictions.rows.map((restriction) => ({
      restrictionId: restriction.restriction_id,
      scope: restriction.scope,
      precautionary: restriction.precautionary,
      restrictionBasis: restriction.restriction_basis,
      ...(restriction.review_due_at ? { reviewDueAt: restriction.review_due_at.toISOString() } : {}),
      narrowestSafeScope: true,
      guiltFinding: false
    })),
    appeals: appeals.rows.map((appeal) => ({
      appealId: appeal.appeal_id,
      subjectType: appeal.subject_type,
      subjectId: appeal.subject_id,
      status: appeal.status,
      submittedAt: appeal.submitted_at.toISOString(),
      independentReviewRequired: true,
      originalDecisionHistoryPreserved: true
    })),
    opaqueDriverScoreUsed: false,
    ratingIsFinding: false,
    ordinaryDeclinePenaltyApplied: false,
    source: 'AUTHORITATIVE_CURRENT_PROJECTION',
    evaluatedAt: new Date().toISOString()
  };
}

async function assertAppealSubjectOwnedByDriver(
  client: Pick<PoolClient, 'query'>,
  driverProfileId: string,
  subjectType: SubmitDriverAppealRequest['subjectType'],
  subjectId: string
): Promise<string | null> {
  if (!DRIVER_APPEAL_SUBJECT_TYPES.includes(subjectType)) {
    throw new DriverFairTreatmentConflictError('Unsupported appeal subject');
  }
  let query: string;
  if (subjectType === 'DRIVER_RESTRICTION') {
    query = 'SELECT applied_by_person_id AS decision_maker_person_id FROM driver.driver_restriction WHERE id = $1 AND driver_profile_id = $2';
  } else if (subjectType === 'COMPLAINT_FINDING') {
    query = `SELECT finding.decided_by_person_id AS decision_maker_person_id FROM driver.driver_complaint_finding finding
              JOIN driver.driver_complaint complaint ON complaint.id = finding.driver_complaint_id
             WHERE finding.id = $1 AND complaint.driver_profile_id = $2`;
  } else if (subjectType === 'OFFBOARDING_DECISION') {
    query = `SELECT decision.authorised_by_person_id AS decision_maker_person_id FROM driver.driver_offboarding_decision decision
              JOIN driver.driver_offboarding_case offboarding ON offboarding.id = decision.driver_offboarding_case_id
             WHERE decision.id = $1 AND offboarding.driver_profile_id = $2`;
  } else {
    query = 'SELECT evaluated_by_person_id AS decision_maker_person_id FROM finance.driver_incentive_qualification WHERE id = $1 AND driver_profile_id = $2';
  }
  const owned = await client.query<{ decision_maker_person_id: string | null }>(query, [subjectId, driverProfileId]);
  if (!owned.rowCount) throw new DriverFairTreatmentNotFoundError('Appealable decision not found for this Driver');
  return owned.rows[0]!.decision_maker_person_id;
}

export async function submitDriverAppeal(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: SubmitDriverAppealRequest,
  idempotencyKey: string
): Promise<SubmitDriverAppealProjection> {
  if (!actor.driverProfileId) throw new DriverFairTreatmentForbiddenError('A Driver profile is required');
  const requestFingerprint = fingerprint({ command: 'SubmitDriverAppeal', request });
  const commandId = randomUUID();
  const correlationId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const profile = await client.query('SELECT 1 FROM driver.driver_profile WHERE id = $1 AND person_id = $2 FOR UPDATE', [
      actor.driverProfileId, actor.personId
    ]);
    if (!profile.rowCount) throw new DriverFairTreatmentNotFoundError('Driver profile not found');
    const duplicate = await client.query<{ request_fingerprint: string; response_body: SubmitDriverAppealProjection }>(
      `SELECT request_fingerprint, response_body FROM driver.command_deduplication
        WHERE command_type = 'SubmitDriverAppeal' AND driver_profile_id = $1 AND idempotency_key = $2`,
      [actor.driverProfileId, idempotencyKey]
    );
    if (duplicate.rowCount) {
      if (duplicate.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new DriverFairTreatmentIdempotencyConflictError('Idempotency key was reused for another appeal');
      }
      await client.query('COMMIT');
      return duplicate.rows[0]!.response_body;
    }
    const originalDecisionMakerPersonId = await assertAppealSubjectOwnedByDriver(
      client, actor.driverProfileId, request.subjectType, request.subjectId
    );
    const inserted = await client.query<{ id: string; submitted_at: Date }>(
      `INSERT INTO driver.driver_decision_appeal
         (driver_profile_id, subject_type, subject_id, original_decision_maker_person_id, status, version,
          reason_category, statement_reference)
       VALUES ($1, $2, $3, $4, 'SUBMITTED', 1, $5, $6)
       RETURNING id, submitted_at`,
      [actor.driverProfileId, request.subjectType, request.subjectId, originalDecisionMakerPersonId,
        request.reasonCategory, request.statementReference]
    );
    const appeal = inserted.rows[0]!;
    await client.query(
      `INSERT INTO driver.driver_decision_appeal_transition
         (driver_decision_appeal_id, from_status, to_status, version, command_id,
          actor_type, actor_id, reason_code)
       VALUES ($1, NULL, 'SUBMITTED', 1, $2, 'DRIVER', $3, 'DRIVER_APPEAL_SUBMITTED')`,
      [appeal.id, commandId, actor.personId]
    );
    for (const evidenceReference of request.evidenceReferences ?? []) {
      await client.query(
        `INSERT INTO driver.driver_decision_appeal_evidence
           (driver_decision_appeal_id, evidence_reference, submitted_by_type, submitted_by_id)
         VALUES ($1, $2, 'DRIVER', $3)`,
        [appeal.id, evidenceReference, actor.personId]
      );
    }
    const response: SubmitDriverAppealProjection = {
      appealId: appeal.id,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      status: 'SUBMITTED',
      submittedAt: appeal.submitted_at.toISOString(),
      independentReviewRequired: true,
      originalDecisionHistoryPreserved: true
    };
    await client.query(
      `INSERT INTO driver.command_deduplication
         (command_id, idempotency_key, command_type, driver_profile_id,
          request_fingerprint, response_status, response_body)
       VALUES ($1, $2, 'SubmitDriverAppeal', $3, $4, 201, $5::jsonb)`,
      [commandId, idempotencyKey, actor.driverProfileId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO driver.outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version,
          correlation_id, causation_id, payload)
       VALUES ('driver.appeal-submitted', 'DriverDecisionAppeal', $1, 1, $2, $3, $4::jsonb)`,
      [appeal.id, correlationId, commandId, JSON.stringify({
        appealId: appeal.id, driverProfileId: actor.driverProfileId,
        subjectType: request.subjectType, subjectId: request.subjectId
      })]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      throw new DriverFairTreatmentConflictError('An appeal already exists for this decision');
    }
    throw error;
  } finally {
    client.release();
  }
}

interface JourneyConductRow {
  journey_id: string;
  journey_status: string;
  journey_leg_id: string;
  booking_id: string;
  booking_status: string;
  booking_version: string | number;
  assignment_id: string;
  assignment_status: string;
  driver_profile_id: string;
  passenger_person_id: string | null;
  availability_status: string;
  availability_version: string | number;
}

async function createRiderConductCase(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: SubmitRiderConductReportRequest,
  idempotencyKey: string,
  terminateJourney: boolean
): Promise<RiderConductCaseProjection | UnsafeJourneyTerminationProjection> {
  if (!actor.driverProfileId) throw new DriverFairTreatmentForbiddenError('A Driver profile is required');
  if (!request.categories.length || request.categories.some((category) => !RIDER_CONDUCT_CATEGORIES.includes(category))) {
    throw new DriverFairTreatmentConflictError('At least one supported rider-conduct category is required');
  }
  const commandType = terminateJourney ? 'SafelyTerminateUnsafeJourney' : 'SubmitRiderConductReport';
  const requestFingerprint = fingerprint({ command: commandType, request });
  const commandId = randomUUID();
  const correlationId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journeyResult = await client.query<JourneyConductRow>(
      `SELECT journey.id AS journey_id, journey.status AS journey_status,
              leg.id AS journey_leg_id, booking.id AS booking_id,
              booking.status AS booking_status, booking.aggregate_version AS booking_version,
              assignment.id AS assignment_id, assignment.status AS assignment_status,
              assignment.driver_profile_id, passenger.person_id AS passenger_person_id,
              availability.status AS availability_status, availability.version AS availability_version
         FROM journey.journey journey
         JOIN journey.journey_leg leg ON leg.journey_id = journey.id
              AND leg.driver_assignment_id = journey.active_assignment_id
         JOIN booking.booking booking ON booking.id = journey.booking_id
         JOIN dispatch.driver_assignment assignment ON assignment.id = journey.active_assignment_id
         JOIN driver.availability_state availability ON availability.driver_profile_id = assignment.driver_profile_id
         LEFT JOIN LATERAL (
           SELECT party.person_id FROM booking.booking_party party
            WHERE party.booking_id = booking.id AND party.role = 'PASSENGER' AND party.person_id IS NOT NULL
            ORDER BY party.created_at ASC LIMIT 1
         ) passenger ON true
        WHERE journey.id = $1
        FOR UPDATE OF journey, leg, booking, assignment, availability`,
      [request.journeyId]
    );
    if (!journeyResult.rowCount) throw new DriverFairTreatmentNotFoundError('Journey not found');
    const journey = journeyResult.rows[0]!;
    if (journey.driver_profile_id !== actor.driverProfileId) {
      throw new DriverFairTreatmentForbiddenError('Only the assigned Driver may report this Journey');
    }
    const duplicate = await client.query<{ request_fingerprint: string; response_body: RiderConductCaseProjection | UnsafeJourneyTerminationProjection }>(
      `SELECT request_fingerprint, response_body FROM safety.command_deduplication
        WHERE command_type = $1 AND actor_id = $2 AND journey_id = $3 AND idempotency_key = $4`,
      [commandType, actor.accountId, request.journeyId, idempotencyKey]
    );
    if (duplicate.rowCount) {
      if (duplicate.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new DriverFairTreatmentIdempotencyConflictError('Idempotency key was reused for another Safety report');
      }
      await client.query('COMMIT');
      return duplicate.rows[0]!.response_body;
    }
    const reportableStatuses = ['EN_ROUTE', 'ARRIVED', 'AWAITING_RIDECHECK', 'PASSENGER_VERIFIED', 'IN_PROGRESS', 'ARRIVING', 'COMPLETED'];
    if (!reportableStatuses.includes(journey.journey_status)) {
      throw new DriverFairTreatmentConflictError(`Rider-conduct reporting is unavailable from ${journey.journey_status}`);
    }
    if (terminateJourney && (journey.assignment_status !== 'ACTIVE' || journey.availability_status !== 'ASSIGNED')) {
      throw new DriverFairTreatmentConflictError('Safe termination requires the current active assignment');
    }
    const safetyEvent = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO safety.safety_event
         (journey_id, trigger_type, severity, status, finding_status, actor_person_id,
          signal_source, do_not_auto_call_reporter, facts, security_classification, correlation_id)
       VALUES ($1, 'RIDER_CONDUCT_REPORT', $2, 'OPEN', 'NOT_ASSESSED', $3,
               'DRIVER', false, $4::jsonb, 'HIGHLY_RESTRICTED', $5)
       RETURNING id, created_at`,
      [request.journeyId, request.immediateDanger ? 'CRITICAL' : 'AT_RISK', actor.personId,
        JSON.stringify({ categories: request.categories, immediateDanger: request.immediateDanger,
          reportReferenceStoredInSafetyOwnedCase: true, misconductFindingCreated: false }), correlationId]
    );
    const safetyEventId = safetyEvent.rows[0]!.id;
    await client.query(
      `INSERT INTO safety.safety_event_transition
         (safety_event_id, from_status, to_status, actor_type, actor_id, reason_code)
       VALUES ($1, NULL, 'OPEN', 'DRIVER', $2, 'RIDER_CONDUCT_REPORTED')`,
      [safetyEventId, actor.accountId]
    );
    const conductCase = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO safety.rider_conduct_case
         (safety_event_id, journey_id, booking_id, reporting_driver_profile_id,
          subject_person_id, categories, report_reference, immediate_danger, status, version)
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, 'OPEN', 1)
       RETURNING id, created_at`,
      [safetyEventId, journey.journey_id, journey.booking_id, actor.driverProfileId,
        journey.passenger_person_id, [...new Set(request.categories)], request.reportReference, request.immediateDanger]
    );
    const conductCaseId = conductCase.rows[0]!.id;
    await client.query(
      `INSERT INTO safety.rider_conduct_case_transition
         (rider_conduct_case_id, from_status, to_status, version, command_id,
          actor_type, actor_id, reason_code)
       VALUES ($1, NULL, 'OPEN', 1, $2, 'DRIVER', $3, 'DRIVER_REPORT_PERSISTED')`,
      [conductCaseId, commandId, actor.personId]
    );

    let response: RiderConductCaseProjection | UnsafeJourneyTerminationProjection;
    if (terminateJourney) {
      if (!unsafeJourneyTerminationMayProceed({
        actorIsAssignedDriver: true,
        journeyStatus: journey.journey_status,
        riderConductCasePersisted: true,
        canonicalSafetyEventPersisted: true
      })) throw new DriverFairTreatmentConflictError('Unsafe Journey cannot be terminated from the current state');
      await client.query(
        `INSERT INTO journey.safety_termination
           (journey_id, rider_conduct_case_id, driver_profile_id, prior_journey_status, reason_code)
         VALUES ($1, $2, $3, $4, 'DRIVER_SAFETY_TERMINATION')`,
        [journey.journey_id, conductCaseId, actor.driverProfileId, journey.journey_status]
      );
      await client.query(
        `UPDATE journey.journey_leg SET status = 'INTERRUPTED', ended_at = now()
          WHERE id = $1`,
        [journey.journey_leg_id]
      );
      await client.query(
        `UPDATE dispatch.driver_assignment
            SET status = 'CANCELLED', ended_at = now(), end_reason = 'DRIVER_SAFETY_TERMINATION'
          WHERE id = $1`,
        [journey.assignment_id]
      );
      const continuity = await client.query<{ id: string }>(
        `INSERT INTO journey.continuity_case (journey_id, status, reason_code, opened_by)
         SELECT $1, 'OPEN', 'DRIVER_SAFETY_TERMINATION', $2
          WHERE NOT EXISTS (
            SELECT 1 FROM journey.continuity_case current_case
             WHERE current_case.journey_id = $1 AND current_case.status = 'OPEN'
          ) RETURNING id`,
        [journey.journey_id, actor.personId]
      );
      if (continuity.rowCount) {
        await client.query(
          `INSERT INTO journey.continuity_case_transition
             (continuity_case_id, from_status, to_status, actor_type, actor_id, reason_code)
           VALUES ($1, NULL, 'OPEN', 'DRIVER', $2, 'DRIVER_SAFETY_TERMINATION')`,
          [continuity.rows[0]!.id, actor.personId]
        );
      }
      const nextBookingVersion = Number(journey.booking_version) + 1;
      await client.query(
        `UPDATE booking.booking SET status = 'ACTIVE_INCIDENT', aggregate_version = $2, updated_at = now()
          WHERE id = $1`,
        [journey.booking_id, nextBookingVersion]
      );
      await client.query(
        `INSERT INTO booking.booking_state_transition
           (booking_id, from_status, to_status, aggregate_version, command_id,
            actor_type, actor_id, reason_code, metadata)
         VALUES ($1, $2::booking.booking_status, 'ACTIVE_INCIDENT', $3, $4,
                 'ACCOUNT', $5, 'DRIVER_SAFETY_TERMINATION', $6::jsonb)`,
        [journey.booking_id, journey.booking_status, nextBookingVersion, randomUUID(), actor.accountId,
          JSON.stringify({ safetyEventId, riderConductCaseId: conductCaseId, driverFaultFindingCreated: false })]
      );
      const nextAvailabilityVersion = Number(journey.availability_version) + 1;
      if (!driverMayEnterBreakAfterUnsafeTermination({
        fromAvailability: journey.availability_status,
        assignmentCancelled: true,
        safetyTerminationPersisted: true,
        passengerContinuityOpened: true
      })) throw new DriverFairTreatmentConflictError('Driver break transition requires the committed Safety termination boundary');
      const availabilityCommandId = randomUUID();
      await client.query(
        `UPDATE driver.availability_state
            SET status = 'BREAK', version = $2, updated_at = now()
          WHERE driver_profile_id = $1`,
        [actor.driverProfileId, nextAvailabilityVersion]
      );
      await client.query(
        `INSERT INTO driver.availability_transition
           (driver_profile_id, from_status, to_status, version, command_id, reason_code)
         VALUES ($1, 'ASSIGNED', 'BREAK', $2, $3, 'DRIVER_SAFETY_TERMINATION')`,
        [actor.driverProfileId, nextAvailabilityVersion, availabilityCommandId]
      );
      await client.query(
        `INSERT INTO driver.driver_shift_event
           (driver_shift_session_id, driver_profile_id, event_type, from_availability,
            to_availability, availability_version, command_id, reason_code)
         SELECT shift.id, $1, 'UNSAFE_TERMINATION_BREAK', 'ASSIGNED', 'BREAK', $2, $3, 'DRIVER_SAFETY_TERMINATION'
           FROM driver.driver_shift_session shift
          WHERE shift.driver_profile_id = $1 AND shift.status = 'ACTIVE'`,
        [actor.driverProfileId, nextAvailabilityVersion, availabilityCommandId]
      );
      response = {
        riderConductCaseId: conductCaseId,
        safetyEventId,
        journeyId: request.journeyId,
        status: 'OPEN',
        safeTerminationProtected: true,
        ratingProtectionRequired: true,
        driverMisconductFindingCreated: false,
        unsafeJourneyTerminated: true,
        bookingStatus: 'ACTIVE_INCIDENT',
        assignmentStatus: 'CANCELLED',
        driverAvailability: 'BREAK',
        passengerContinuityOpened: true,
        ratingProtected: true,
        driverFaultFindingCreated: false,
        recordedAt: conductCase.rows[0]!.created_at.toISOString()
      };
    } else {
      response = {
        riderConductCaseId: conductCaseId,
        safetyEventId,
        journeyId: request.journeyId,
        status: 'OPEN',
        safeTerminationProtected: true,
        ratingProtectionRequired: true,
        driverMisconductFindingCreated: false,
        unsafeJourneyTerminated: false,
        recordedAt: conductCase.rows[0]!.created_at.toISOString()
      };
    }
    await client.query(
      `INSERT INTO safety.outbox_message
         (safety_event_id, event_type, event_version, security_classification,
          correlation_id, causation_id, payload)
       VALUES ($1, $2, 1, 'HIGHLY_RESTRICTED', $3, $4, $5::jsonb)`,
      [safetyEventId, terminateJourney ? 'safety.unsafe-journey-terminated' : 'safety.rider-conduct-reported',
        correlationId, commandId, JSON.stringify({ safetyEventId, riderConductCaseId: conductCaseId,
          journeyId: request.journeyId, terminateJourney, ratingProtected: true,
          driverMisconductFindingCreated: false })]
    );
    await client.query(
      `INSERT INTO driver.outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version,
          correlation_id, causation_id, payload)
       VALUES ($1, 'RiderConductCase', $2, 1, $3, $4, $5::jsonb)`,
      [terminateJourney ? 'driver.unsafe-journey-terminated' : 'driver.rider-conduct-reported',
        conductCaseId, correlationId, commandId, JSON.stringify({ riderConductCaseId: conductCaseId,
          driverProfileId: actor.driverProfileId, journeyId: request.journeyId })]
    );
    await client.query(
      `INSERT INTO safety.command_deduplication
         (command_id, idempotency_key, command_type, actor_id, journey_id,
          response_status, response_body, request_fingerprint)
       VALUES ($1, $2, $3, $4, $5, 201, $6::jsonb, $7)`,
      [commandId, idempotencyKey, commandType, actor.accountId, request.journeyId,
        JSON.stringify(response), requestFingerprint]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') {
      throw new DriverFairTreatmentConflictError('This Journey already has the recorded terminal Safety action');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function submitRiderConductReport(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: SubmitRiderConductReportRequest,
  idempotencyKey: string
): Promise<RiderConductCaseProjection> {
  return createRiderConductCase(pool, actor, request, idempotencyKey, false) as Promise<RiderConductCaseProjection>;
}

export async function safelyTerminateUnsafeJourney(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  request: SubmitRiderConductReportRequest,
  idempotencyKey: string
): Promise<UnsafeJourneyTerminationProjection> {
  return createRiderConductCase(pool, actor, request, idempotencyKey, true) as Promise<UnsafeJourneyTerminationProjection>;
}

export async function listCurrentDriverIncentives(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  regionCode: string
): Promise<readonly DriverIncentiveProjection[]> {
  if (!actor.driverProfileId) throw new DriverFairTreatmentForbiddenError('A Driver profile is required');
  const programmes = await pool.query<{
    programme_version_id: string;
    programme_key: string;
    version: string | number;
    title: string;
    region_code: string;
    visible_terms: string[];
    effective_from: Date;
    effective_until: Date | null;
    outcome: 'QUALIFIED' | 'NOT_QUALIFIED' | 'PENDING_EVIDENCE' | null;
    explanation: string | null;
    amount_minor: string | number | null;
    currency: string | null;
    evaluated_at: Date | null;
  }>(
    `SELECT programme.id AS programme_version_id, programme.programme_key, programme.version,
            programme.title, programme.region_code, programme.visible_terms,
            programme.effective_from, programme.effective_until,
            qualification.outcome, qualification.explanation, qualification.amount_minor,
            qualification.currency, qualification.evaluated_at
       FROM finance.current_driver_incentive_programme programme
       LEFT JOIN finance.driver_incentive_qualification qualification
         ON qualification.programme_version_id = programme.id
        AND qualification.driver_profile_id = $1
      WHERE programme.region_code = $2
      ORDER BY programme.title, programme.version DESC`,
    [actor.driverProfileId, regionCode]
  );
  return programmes.rows.map((programme) => ({
    programmeVersionId: programme.programme_version_id,
    programmeKey: programme.programme_key,
    version: Number(programme.version),
    title: programme.title,
    regionCode: programme.region_code,
    visibleTerms: programme.visible_terms,
    effectiveFrom: programme.effective_from.toISOString(),
    ...(programme.effective_until ? { effectiveUntil: programme.effective_until.toISOString() } : {}),
    ...(programme.outcome && programme.explanation && programme.evaluated_at ? {
      qualification: {
        outcome: programme.outcome,
        explanation: programme.explanation,
        ...(programme.amount_minor === null ? {} : { amountMinor: Number(programme.amount_minor) }),
        ...(programme.currency ? { currency: programme.currency } : {}),
        evaluatedAt: programme.evaluated_at.toISOString()
      }
    } : {}),
    disputeRoute: 'DRIVER_APPEAL',
    baseEarningSeparate: true,
    acceptanceCoercionAllowed: false,
    fatiguePressureAllowed: false,
    secretDispatchPriorityBoostAllowed: false,
    financeApproved: true
  }));
}
