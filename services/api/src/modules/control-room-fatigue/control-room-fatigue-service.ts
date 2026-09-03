import { createHash, randomUUID } from 'node:crypto';
import type {
  ClaimFatigueHandoverProjection,
  CompleteFatigueHandoverProjection,
  CompleteFatigueHandoverRequest,
  ConfirmFatigueSafeStopProjection,
  ConfirmFatigueSafeStopRequest,
  ControlRoomFatigueHandoverTaskProjection,
  FatigueHandoverNextAction,
  RecordFatigueReplacementAssignmentProjection,
  RecordFatigueReplacementAssignmentRequest,
  RecordFatiguePassengerTransferProjection,
  RecordFatiguePassengerTransferRequest
} from '@dazat/contracts';
import type { DatabasePool } from '../../db.js';
import type { AuthenticatedPrincipal } from '../identity/session-service.js';

export class ControlRoomFatigueForbiddenError extends Error {}
export class ControlRoomFatigueNotFoundError extends Error {}
export class ControlRoomFatigueConflictError extends Error {}
export class ControlRoomFatigueIdempotencyConflictError extends Error {}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function getFatigueHandoverTask(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  controlledHandoverId: string
): Promise<ControlRoomFatigueHandoverTaskProjection> {
  if (actor.accountStatus !== 'ACTIVE') {
    throw new ControlRoomFatigueForbiddenError('An active account is required for Control Room work');
  }
  const result = await pool.query<{
    task_scope_id: string;
    status: ControlRoomFatigueHandoverTaskProjection['status'];
    version: string | number;
    journey_id: string;
    support_case_id: string;
    support_case_status: ControlRoomFatigueHandoverTaskProjection['supportCaseStatus'];
    hold_status: ControlRoomFatigueHandoverTaskProjection['operationalHoldStatus'];
    assignment_status: string;
    replacement_assignment_recorded: boolean;
    passenger_transfer_recorded: boolean;
    safe_stop_recorded: boolean;
    server_now: Date;
  }>(
    `SELECT task.id AS task_scope_id, handover.status, handover.version, handover.journey_id,
            handover.support_case_id, support_case.status AS support_case_status,
            hold.status AS hold_status, assignment.status AS assignment_status,
            handover.replacement_assignment_id IS NOT NULL AS replacement_assignment_recorded,
            handover.passenger_transfer_evidence_reference IS NOT NULL AS passenger_transfer_recorded,
            handover.safe_stop_evidence_reference IS NOT NULL AS safe_stop_recorded,
            clock_timestamp() AS server_now
       FROM operations.control_room_task_scope task
       JOIN operations.control_room_role_assignment role_assignment ON role_assignment.id = task.role_assignment_id
       JOIN operations.driver_fatigue_handover handover ON handover.id = task.subject_id
       JOIN operations.driver_support_case support_case ON support_case.id = handover.support_case_id
       JOIN journey.operational_hold hold ON hold.id = handover.operational_hold_id
       JOIN dispatch.driver_assignment assignment ON assignment.id = handover.assignment_id
      WHERE task.subject_id = $1 AND task.operator_person_id = $2
        AND task.purpose = 'DRIVER_FATIGUE_HANDOVER'
        AND task.valid_from <= now() AND task.valid_until > now()
        AND role_assignment.operator_person_id = $2
        AND role_assignment.valid_from <= now() AND role_assignment.valid_until > now()`,
    [controlledHandoverId, actor.personId]
  );
  if (!result.rowCount) throw new ControlRoomFatigueNotFoundError('Current task-scoped fatigue handover not found');
  const row = result.rows[0]!;
  const permittedNextActions: FatigueHandoverNextAction[] = [];
  if (row.status === 'OWNED') permittedNextActions.push('RECORD_REPLACEMENT_ASSIGNMENT', 'CONFIRM_SAFE_STOP');
  if (row.status === 'REPLACEMENT_ASSIGNED') permittedNextActions.push('RECORD_PASSENGER_TRANSFER', 'CONFIRM_SAFE_STOP');
  if (row.status === 'PASSENGER_TRANSFERRED' || row.status === 'SAFE_STOP_CONFIRMED') permittedNextActions.push('COMPLETE_HANDOVER');
  return {
    controlledHandoverId,
    taskScopeId: row.task_scope_id,
    status: row.status,
    version: Number(row.version),
    journeyId: row.journey_id,
    supportCaseId: row.support_case_id,
    supportCaseStatus: row.support_case_status,
    operationalHoldStatus: row.hold_status,
    originalAssignmentStatus: row.assignment_status,
    replacementAssignmentRecorded: row.replacement_assignment_recorded,
    passengerTransferEvidenceRecorded: row.passenger_transfer_recorded,
    safeStopEvidenceRecorded: row.safe_stop_recorded,
    passengerContinuityRequired: true,
    permittedNextActions,
    passengerIdentityIncluded: false,
    passengerContactIncluded: false,
    preciseLocationIncluded: false,
    safetyNarrativeIncluded: false,
    financialDataIncluded: false,
    taskScopeAuthoritative: true,
    evaluatedAt: row.server_now.toISOString()
  };
}

export async function claimFatigueHandover(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  controlledHandoverId: string,
  idempotencyKey: string
): Promise<ClaimFatigueHandoverProjection> {
  if (actor.accountStatus !== 'ACTIVE') {
    throw new ControlRoomFatigueForbiddenError('An active account is required for Control Room work');
  }
  const requestFingerprint = fingerprint({ controlledHandoverId });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      request_fingerprint: string;
      response_body: ClaimFatigueHandoverProjection;
    }>(
      `SELECT request_fingerprint, response_body FROM operations.control_room_command_deduplication
        WHERE command_type = 'ClaimFatigueHandover' AND operator_person_id = $1 AND idempotency_key = $2`,
      [actor.personId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new ControlRoomFatigueIdempotencyConflictError('Idempotency key was already used for another handover claim');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const role = await client.query<{ id: string; valid_until: Date }>(
      `SELECT id, valid_until FROM operations.control_room_role_assignment
        WHERE operator_person_id = $1 AND role_code IN ('FATIGUE_HANDOVER_OPERATOR','SAFETY_SUPERVISOR')
          AND valid_from <= now() AND valid_until > now()
        ORDER BY role_code, valid_until LIMIT 1 FOR SHARE`,
      [actor.personId]
    );
    if (!role.rowCount) throw new ControlRoomFatigueForbiddenError('Current fatigue-handover operator authority is required');
    const handover = await client.query<{
      support_case_id: string;
      operational_hold_id: string;
      version: string | number;
    }>(
      `SELECT handover.support_case_id, handover.operational_hold_id, handover.version
         FROM operations.driver_fatigue_handover handover
         JOIN operations.driver_support_case support_case ON support_case.id = handover.support_case_id
         JOIN journey.operational_hold hold ON hold.id = handover.operational_hold_id
        WHERE handover.id = $1 AND handover.status = 'REQUESTED'
          AND support_case.status = 'HUMAN_ESCALATION_REQUIRED' AND hold.status = 'ACTIVE'
        FOR UPDATE OF handover, support_case, hold`,
      [controlledHandoverId]
    );
    if (!handover.rowCount) throw new ControlRoomFatigueNotFoundError('Claimable fatigue handover not found');
    const row = handover.rows[0]!;
    const nowResult = await client.query<{ server_now: Date }>('SELECT clock_timestamp() AS server_now');
    const claimedAt = nowResult.rows[0]!.server_now;
    const roleExpiry = role.rows[0]!.valid_until;
    const taskExpiry = new Date(Math.min(roleExpiry.getTime(), claimedAt.getTime() + 4 * 60 * 60 * 1_000));
    if (taskExpiry.getTime() <= claimedAt.getTime()) {
      throw new ControlRoomFatigueConflictError('Operator authority expired before task ownership could be recorded');
    }
    const taskScope = await client.query<{ id: string }>(
      `INSERT INTO operations.control_room_task_scope
         (operator_person_id, role_assignment_id, purpose, subject_type, subject_id, valid_from, valid_until)
       VALUES ($1,$2,'DRIVER_FATIGUE_HANDOVER','DRIVER_FATIGUE_HANDOVER',$3,$4,$5) RETURNING id`,
      [actor.personId, role.rows[0]!.id, controlledHandoverId, claimedAt, taskExpiry]
    );
    const version = Number(row.version) + 1;
    await client.query(
      `UPDATE operations.driver_fatigue_handover
          SET status = 'OWNED', owned_by_person_id = $2, version = $3, updated_at = $4
        WHERE id = $1`,
      [controlledHandoverId, actor.personId, version, claimedAt]
    );
    await client.query(
      `INSERT INTO operations.driver_fatigue_handover_transition
         (handover_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,'REQUESTED','OWNED','CONTROL_ROOM',$2,'TASK_SCOPED_OPERATOR_CLAIM',$3::jsonb,$4)`,
      [controlledHandoverId, actor.personId, JSON.stringify([`task-scope:${taskScope.rows[0]!.id}`]), claimedAt]
    );
    await client.query(
      `UPDATE operations.driver_support_case SET status = 'IN_PROGRESS', updated_at = $2
        WHERE id = $1 AND status = 'HUMAN_ESCALATION_REQUIRED'`,
      [row.support_case_id, claimedAt]
    );
    await client.query(
      `INSERT INTO operations.driver_support_case_event
         (support_case_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,'HUMAN_ESCALATION_REQUIRED','IN_PROGRESS','CONTROL_ROOM',$2,'FATIGUE_HANDOVER_OWNED',$3::jsonb,$4)`,
      [row.support_case_id, actor.personId, JSON.stringify([`task-scope:${taskScope.rows[0]!.id}`]), claimedAt]
    );
    const response: ClaimFatigueHandoverProjection = {
      controlledHandoverId,
      taskScopeId: taskScope.rows[0]!.id,
      status: 'OWNED',
      version,
      supportCaseStatus: 'IN_PROGRESS',
      operationalHoldStatus: 'ACTIVE',
      passengerContinuityRequired: true,
      outcomeClaimed: false,
      externalServiceContacted: false,
      claimedAt: claimedAt.toISOString()
    };
    await client.query(
      `INSERT INTO operations.control_room_command_deduplication
         (command_id, idempotency_key, command_type, operator_person_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'ClaimFatigueHandover',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, actor.personId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO operations.control_room_outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
       VALUES ('control-room.fatigue-handover-owned','DriverFatigueHandover',$1,$2,$3,$4,$5::jsonb)`,
      [controlledHandoverId, version, correlationId, commandId, JSON.stringify(response)]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmFatigueSafeStop(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  controlledHandoverId: string,
  request: ConfirmFatigueSafeStopRequest,
  idempotencyKey: string
): Promise<ConfirmFatigueSafeStopProjection> {
  if (actor.accountStatus !== 'ACTIVE') {
    throw new ControlRoomFatigueForbiddenError('An active account is required for Control Room work');
  }
  const requestFingerprint = fingerprint({ controlledHandoverId, ...request });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      request_fingerprint: string;
      response_body: ConfirmFatigueSafeStopProjection;
    }>(
      `SELECT request_fingerprint, response_body FROM operations.control_room_command_deduplication
        WHERE command_type = 'ConfirmFatigueSafeStop' AND operator_person_id = $1 AND idempotency_key = $2`,
      [actor.personId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new ControlRoomFatigueIdempotencyConflictError('Idempotency key was already used for another safe-stop confirmation');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const handover = await client.query<{
      task_scope_id: string;
      from_status: 'OWNED' | 'REPLACEMENT_ASSIGNED';
      version: string | number;
      support_case_status: string;
      hold_status: string;
    }>(
      `SELECT task.id AS task_scope_id, handover.status AS from_status, handover.version,
              support_case.status AS support_case_status, hold.status AS hold_status
         FROM operations.control_room_task_scope task
         JOIN operations.control_room_role_assignment role_assignment ON role_assignment.id = task.role_assignment_id
         JOIN operations.driver_fatigue_handover handover ON handover.id = task.subject_id
         JOIN operations.driver_support_case support_case ON support_case.id = handover.support_case_id
         JOIN journey.operational_hold hold ON hold.id = handover.operational_hold_id
        WHERE task.subject_id = $1 AND task.operator_person_id = $2
          AND task.purpose = 'DRIVER_FATIGUE_HANDOVER'
          AND task.valid_from <= now() AND task.valid_until > now()
          AND role_assignment.operator_person_id = $2
          AND role_assignment.valid_from <= now() AND role_assignment.valid_until > now()
          AND handover.status IN ('OWNED','REPLACEMENT_ASSIGNED')
          AND support_case.status = 'IN_PROGRESS' AND hold.status = 'ACTIVE'
        FOR UPDATE OF handover, support_case, hold`,
      [controlledHandoverId, actor.personId]
    );
    if (!handover.rowCount) {
      throw new ControlRoomFatigueConflictError('Current task, active hold and eligible handover state are required');
    }
    const row = handover.rows[0]!;
    const nowResult = await client.query<{ server_now: Date }>('SELECT clock_timestamp() AS server_now');
    const confirmedAt = nowResult.rows[0]!.server_now;
    const version = Number(row.version) + 1;
    await client.query(
      `UPDATE operations.driver_fatigue_handover
          SET status = 'SAFE_STOP_CONFIRMED', safe_stop_evidence_reference = $2,
              version = $3, updated_at = $4
        WHERE id = $1`,
      [controlledHandoverId, request.evidenceReference, version, confirmedAt]
    );
    await client.query(
      `INSERT INTO operations.driver_fatigue_handover_transition
         (handover_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,$2,'SAFE_STOP_CONFIRMED','CONTROL_ROOM',$3,'SAFE_STOP_EVIDENCE_RECORDED',$4::jsonb,$5)`,
      [controlledHandoverId, row.from_status, actor.personId, JSON.stringify([request.evidenceReference]), confirmedAt]
    );
    const response: ConfirmFatigueSafeStopProjection = {
      controlledHandoverId,
      taskScopeId: row.task_scope_id,
      status: 'SAFE_STOP_CONFIRMED',
      version,
      safeStopEvidenceRecorded: true,
      operationalHoldStatus: 'ACTIVE',
      supportCaseStatus: 'IN_PROGRESS',
      passengerContinuityRequired: true,
      handoverComplete: false,
      externalServiceContacted: false,
      confirmedAt: confirmedAt.toISOString()
    };
    await client.query(
      `INSERT INTO operations.control_room_command_deduplication
         (command_id, idempotency_key, command_type, operator_person_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'ConfirmFatigueSafeStop',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, actor.personId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO operations.control_room_outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
       VALUES ('control-room.fatigue-safe-stop-confirmed','DriverFatigueHandover',$1,$2,$3,$4,$5::jsonb)`,
      [controlledHandoverId, version, correlationId, commandId, JSON.stringify(response)]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeFatigueHandover(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  controlledHandoverId: string,
  request: CompleteFatigueHandoverRequest,
  idempotencyKey: string
): Promise<CompleteFatigueHandoverProjection> {
  if (actor.accountStatus !== 'ACTIVE') {
    throw new ControlRoomFatigueForbiddenError('An active account is required for Control Room work');
  }
  const requestFingerprint = fingerprint({ controlledHandoverId, ...request });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      request_fingerprint: string;
      response_body: CompleteFatigueHandoverProjection;
    }>(
      `SELECT request_fingerprint, response_body FROM operations.control_room_command_deduplication
        WHERE command_type = 'CompleteFatigueHandover' AND operator_person_id = $1 AND idempotency_key = $2`,
      [actor.personId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new ControlRoomFatigueIdempotencyConflictError('Idempotency key was already used for another handover completion');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const handover = await client.query<{
      task_scope_id: string;
      from_status: 'PASSENGER_TRANSFERRED' | 'SAFE_STOP_CONFIRMED';
      version: string | number;
      support_case_id: string;
      operational_hold_id: string;
    }>(
      `SELECT task.id AS task_scope_id, handover.status AS from_status, handover.version,
              handover.support_case_id, handover.operational_hold_id
         FROM operations.control_room_task_scope task
         JOIN operations.control_room_role_assignment role_assignment ON role_assignment.id = task.role_assignment_id
         JOIN operations.driver_fatigue_handover handover ON handover.id = task.subject_id
         JOIN operations.driver_support_case support_case ON support_case.id = handover.support_case_id
         JOIN journey.operational_hold hold ON hold.id = handover.operational_hold_id
         JOIN dispatch.driver_assignment assignment ON assignment.id = handover.assignment_id
         JOIN journey.journey_leg leg ON leg.driver_assignment_id = assignment.id
        WHERE task.subject_id = $1 AND task.operator_person_id = $2
          AND task.purpose = 'DRIVER_FATIGUE_HANDOVER'
          AND task.valid_from <= now() AND task.valid_until > now()
          AND role_assignment.operator_person_id = $2
          AND role_assignment.valid_from <= now() AND role_assignment.valid_until > now()
          AND handover.status IN ('PASSENGER_TRANSFERRED','SAFE_STOP_CONFIRMED')
          AND support_case.status = 'IN_PROGRESS' AND hold.status = 'ACTIVE'
          AND hold.reason_code = 'DRIVER_FATIGUE_SAFETY'
          AND assignment.status IN ('CANCELLED','COMPLETED','REASSIGNED')
          AND leg.status IN ('INTERRUPTED','COMPLETED')
        FOR UPDATE OF handover, support_case, hold, assignment, leg`,
      [controlledHandoverId, actor.personId]
    );
    if (!handover.rowCount) {
      throw new ControlRoomFatigueConflictError('Terminal original assignment and journey leg, current task, evidence and active fatigue hold are required');
    }
    const row = handover.rows[0]!;
    const nowResult = await client.query<{ server_now: Date }>('SELECT clock_timestamp() AS server_now');
    const completedAt = nowResult.rows[0]!.server_now;
    const version = Number(row.version) + 1;
    await client.query(
      `UPDATE operations.driver_fatigue_handover
          SET status = 'COMPLETED', completed_at = $2, version = $3, updated_at = $2
        WHERE id = $1`,
      [controlledHandoverId, completedAt, version]
    );
    await client.query(
      `INSERT INTO operations.driver_fatigue_handover_transition
         (handover_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,$2,'COMPLETED','CONTROL_ROOM',$3,'PASSENGER_CONTINUITY_VERIFIED',$4::jsonb,$5)`,
      [controlledHandoverId, row.from_status, actor.personId, JSON.stringify([request.completionEvidenceReference]), completedAt]
    );
    await client.query(
      `UPDATE journey.operational_hold
          SET status = 'RELEASED', released_at = $2, released_by = $3,
              release_reason = 'FATIGUE_HANDOVER_COMPLETED'
        WHERE id = $1 AND status = 'ACTIVE' AND reason_code = 'DRIVER_FATIGUE_SAFETY'`,
      [row.operational_hold_id, completedAt, actor.personId]
    );
    await client.query(
      `INSERT INTO journey.operational_hold_transition
         (operational_hold_id, from_status, to_status, actor_type, actor_id, reason_code, occurred_at)
       VALUES ($1,'ACTIVE','RELEASED','CONTROL_ROOM',$2,'FATIGUE_HANDOVER_COMPLETED',$3)`,
      [row.operational_hold_id, actor.personId, completedAt]
    );
    await client.query(
      `UPDATE operations.driver_support_case SET status = 'RESOLVED', updated_at = $2
        WHERE id = $1 AND status = 'IN_PROGRESS'`,
      [row.support_case_id, completedAt]
    );
    await client.query(
      `INSERT INTO operations.driver_support_case_event
         (support_case_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,'IN_PROGRESS','RESOLVED','CONTROL_ROOM',$2,'FATIGUE_HANDOVER_COMPLETED',$3::jsonb,$4)`,
      [row.support_case_id, actor.personId, JSON.stringify([request.completionEvidenceReference]), completedAt]
    );
    const response: CompleteFatigueHandoverProjection = {
      controlledHandoverId,
      taskScopeId: row.task_scope_id,
      status: 'COMPLETED',
      version,
      operationalHoldStatus: 'RELEASED',
      supportCaseStatus: 'RESOLVED',
      passengerContinuityVerified: true,
      fatigueObservationCleared: false,
      driverReturnedToWork: false,
      externalServiceContacted: false,
      completedAt: completedAt.toISOString()
    };
    await client.query(
      `INSERT INTO operations.control_room_command_deduplication
         (command_id, idempotency_key, command_type, operator_person_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'CompleteFatigueHandover',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, actor.personId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO operations.control_room_outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
       VALUES ('control-room.fatigue-handover-completed','DriverFatigueHandover',$1,$2,$3,$4,$5::jsonb)`,
      [controlledHandoverId, version, correlationId, commandId, JSON.stringify(response)]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordFatigueReplacementAssignment(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  controlledHandoverId: string,
  request: RecordFatigueReplacementAssignmentRequest,
  idempotencyKey: string
): Promise<RecordFatigueReplacementAssignmentProjection> {
  if (actor.accountStatus !== 'ACTIVE') {
    throw new ControlRoomFatigueForbiddenError('An active account is required for Control Room work');
  }
  const requestFingerprint = fingerprint({ controlledHandoverId, ...request });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      request_fingerprint: string;
      response_body: RecordFatigueReplacementAssignmentProjection;
    }>(
      `SELECT request_fingerprint, response_body FROM operations.control_room_command_deduplication
        WHERE command_type = 'RecordFatigueReplacementAssignment' AND operator_person_id = $1 AND idempotency_key = $2`,
      [actor.personId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new ControlRoomFatigueIdempotencyConflictError('Idempotency key was already used for another replacement assignment');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const handover = await client.query<{
      task_scope_id: string;
      version: string | number;
    }>(
      `SELECT task.id AS task_scope_id, handover.version
         FROM operations.control_room_task_scope task
         JOIN operations.control_room_role_assignment role_assignment ON role_assignment.id = task.role_assignment_id
         JOIN operations.driver_fatigue_handover handover ON handover.id = task.subject_id
         JOIN operations.driver_support_case support_case ON support_case.id = handover.support_case_id
         JOIN journey.operational_hold hold ON hold.id = handover.operational_hold_id
         JOIN dispatch.driver_assignment original ON original.id = handover.assignment_id
         JOIN journey.journey_leg original_leg ON original_leg.driver_assignment_id = original.id
         JOIN dispatch.driver_assignment replacement ON replacement.id = $3
         JOIN journey.journey current_journey ON current_journey.id = handover.journey_id
         JOIN journey.journey_leg replacement_leg
           ON replacement_leg.journey_id = current_journey.id AND replacement_leg.driver_assignment_id = replacement.id
        WHERE task.subject_id = $1 AND task.operator_person_id = $2
          AND task.purpose = 'DRIVER_FATIGUE_HANDOVER'
          AND task.valid_from <= now() AND task.valid_until > now()
          AND role_assignment.operator_person_id = $2
          AND role_assignment.valid_from <= now() AND role_assignment.valid_until > now()
          AND handover.status = 'OWNED' AND support_case.status = 'IN_PROGRESS'
          AND hold.status = 'ACTIVE' AND hold.reason_code = 'DRIVER_FATIGUE_SAFETY'
          AND original.id <> replacement.id
          AND original.booking_id = replacement.booking_id
          AND original.status IN ('CANCELLED','REASSIGNED') AND original_leg.status = 'INTERRUPTED'
          AND replacement.status = 'ACTIVE'
          AND replacement.driver_profile_id <> handover.driver_profile_id
          AND current_journey.active_assignment_id = replacement.id
          AND replacement_leg.status NOT IN ('INTERRUPTED','COMPLETED')
        FOR UPDATE OF handover, support_case, hold, original, original_leg, replacement, current_journey, replacement_leg`,
      [controlledHandoverId, actor.personId, request.replacementAssignmentId]
    );
    if (!handover.rowCount) {
      throw new ControlRoomFatigueConflictError('A canonically active replacement and terminal original assignment are required');
    }
    const row = handover.rows[0]!;
    const nowResult = await client.query<{ server_now: Date }>('SELECT clock_timestamp() AS server_now');
    const recordedAt = nowResult.rows[0]!.server_now;
    const version = Number(row.version) + 1;
    await client.query(
      `UPDATE operations.driver_fatigue_handover
          SET status = 'REPLACEMENT_ASSIGNED', replacement_assignment_id = $2,
              version = $3, updated_at = $4
        WHERE id = $1`,
      [controlledHandoverId, request.replacementAssignmentId, version, recordedAt]
    );
    await client.query(
      `INSERT INTO operations.driver_fatigue_handover_transition
         (handover_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,'OWNED','REPLACEMENT_ASSIGNED','CONTROL_ROOM',$2,'CANONICAL_REPLACEMENT_VERIFIED',$3::jsonb,$4)`,
      [controlledHandoverId, actor.personId, JSON.stringify([request.evidenceReference]), recordedAt]
    );
    const response: RecordFatigueReplacementAssignmentProjection = {
      controlledHandoverId,
      taskScopeId: row.task_scope_id,
      replacementAssignmentId: request.replacementAssignmentId,
      status: 'REPLACEMENT_ASSIGNED',
      version,
      operationalHoldStatus: 'ACTIVE',
      supportCaseStatus: 'IN_PROGRESS',
      passengerContinuityRequired: true,
      passengerTransferEvidenceRecorded: false,
      handoverComplete: false,
      externalServiceContacted: false,
      recordedAt: recordedAt.toISOString()
    };
    await client.query(
      `INSERT INTO operations.control_room_command_deduplication
         (command_id, idempotency_key, command_type, operator_person_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'RecordFatigueReplacementAssignment',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, actor.personId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO operations.control_room_outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
       VALUES ('control-room.fatigue-replacement-assignment-recorded','DriverFatigueHandover',$1,$2,$3,$4,$5::jsonb)`,
      [controlledHandoverId, version, correlationId, commandId, JSON.stringify(response)]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordFatiguePassengerTransfer(
  pool: DatabasePool,
  actor: AuthenticatedPrincipal,
  controlledHandoverId: string,
  request: RecordFatiguePassengerTransferRequest,
  idempotencyKey: string
): Promise<RecordFatiguePassengerTransferProjection> {
  if (actor.accountStatus !== 'ACTIVE') {
    throw new ControlRoomFatigueForbiddenError('An active account is required for Control Room work');
  }
  const requestFingerprint = fingerprint({ controlledHandoverId, ...request });
  const client = await pool.connect();
  const commandId = randomUUID();
  const correlationId = randomUUID();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{
      request_fingerprint: string;
      response_body: RecordFatiguePassengerTransferProjection;
    }>(
      `SELECT request_fingerprint, response_body FROM operations.control_room_command_deduplication
        WHERE command_type = 'RecordFatiguePassengerTransfer' AND operator_person_id = $1 AND idempotency_key = $2`,
      [actor.personId, idempotencyKey]
    );
    if (existing.rowCount) {
      if (existing.rows[0]!.request_fingerprint !== requestFingerprint) {
        throw new ControlRoomFatigueIdempotencyConflictError('Idempotency key was already used for another passenger transfer');
      }
      await client.query('COMMIT');
      return existing.rows[0]!.response_body;
    }
    const handover = await client.query<{
      task_scope_id: string;
      version: string | number;
    }>(
      `SELECT task.id AS task_scope_id, handover.version
         FROM operations.control_room_task_scope task
         JOIN operations.control_room_role_assignment role_assignment ON role_assignment.id = task.role_assignment_id
         JOIN operations.driver_fatigue_handover handover ON handover.id = task.subject_id
         JOIN operations.driver_support_case support_case ON support_case.id = handover.support_case_id
         JOIN journey.operational_hold hold ON hold.id = handover.operational_hold_id
         JOIN dispatch.driver_assignment original ON original.id = handover.assignment_id
         JOIN journey.journey_leg original_leg ON original_leg.driver_assignment_id = original.id
         JOIN dispatch.driver_assignment replacement ON replacement.id = handover.replacement_assignment_id
         JOIN journey.journey current_journey ON current_journey.id = handover.journey_id
         JOIN journey.journey_leg replacement_leg
           ON replacement_leg.journey_id = current_journey.id AND replacement_leg.driver_assignment_id = replacement.id
        WHERE task.subject_id = $1 AND task.operator_person_id = $2
          AND task.purpose = 'DRIVER_FATIGUE_HANDOVER'
          AND task.valid_from <= now() AND task.valid_until > now()
          AND role_assignment.operator_person_id = $2
          AND role_assignment.valid_from <= now() AND role_assignment.valid_until > now()
          AND handover.status = 'REPLACEMENT_ASSIGNED'
          AND support_case.status = 'IN_PROGRESS'
          AND hold.status = 'ACTIVE' AND hold.reason_code = 'DRIVER_FATIGUE_SAFETY'
          AND original.status IN ('CANCELLED','REASSIGNED') AND original_leg.status = 'INTERRUPTED'
          AND replacement.status = 'ACTIVE'
          AND current_journey.active_assignment_id = replacement.id
          AND replacement_leg.status = 'IN_PROGRESS'
        FOR UPDATE OF handover, support_case, hold, original, original_leg, replacement, current_journey, replacement_leg`,
      [controlledHandoverId, actor.personId]
    );
    if (!handover.rowCount) {
      throw new ControlRoomFatigueConflictError('An in-progress canonical replacement leg and current handover task are required');
    }
    const row = handover.rows[0]!;
    const nowResult = await client.query<{ server_now: Date }>('SELECT clock_timestamp() AS server_now');
    const recordedAt = nowResult.rows[0]!.server_now;
    const version = Number(row.version) + 1;
    await client.query(
      `UPDATE operations.driver_fatigue_handover
          SET status = 'PASSENGER_TRANSFERRED', passenger_transfer_evidence_reference = $2,
              version = $3, updated_at = $4
        WHERE id = $1`,
      [controlledHandoverId, request.evidenceReference, version, recordedAt]
    );
    await client.query(
      `INSERT INTO operations.driver_fatigue_handover_transition
         (handover_id, from_status, to_status, actor_type, actor_id, reason_code, evidence_references, occurred_at)
       VALUES ($1,'REPLACEMENT_ASSIGNED','PASSENGER_TRANSFERRED','CONTROL_ROOM',$2,'PASSENGER_TRANSFER_EVIDENCE_RECORDED',$3::jsonb,$4)`,
      [controlledHandoverId, actor.personId, JSON.stringify([request.evidenceReference]), recordedAt]
    );
    const response: RecordFatiguePassengerTransferProjection = {
      controlledHandoverId,
      taskScopeId: row.task_scope_id,
      status: 'PASSENGER_TRANSFERRED',
      version,
      passengerTransferEvidenceRecorded: true,
      operationalHoldStatus: 'ACTIVE',
      supportCaseStatus: 'IN_PROGRESS',
      passengerContinuityRequired: true,
      handoverComplete: false,
      externalServiceContacted: false,
      recordedAt: recordedAt.toISOString()
    };
    await client.query(
      `INSERT INTO operations.control_room_command_deduplication
         (command_id, idempotency_key, command_type, operator_person_id, request_fingerprint, response_status, response_body)
       VALUES ($1,$2,'RecordFatiguePassengerTransfer',$3,$4,200,$5::jsonb)`,
      [commandId, idempotencyKey, actor.personId, requestFingerprint, JSON.stringify(response)]
    );
    await client.query(
      `INSERT INTO operations.control_room_outbox_message
         (event_type, aggregate_type, aggregate_id, aggregate_version, correlation_id, causation_id, payload)
       VALUES ('control-room.fatigue-passenger-transfer-recorded','DriverFatigueHandover',$1,$2,$3,$4,$5::jsonb)`,
      [controlledHandoverId, version, correlationId, commandId, JSON.stringify(response)]
    );
    await client.query('COMMIT');
    return response;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
