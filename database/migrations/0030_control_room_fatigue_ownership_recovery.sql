-- DAZAT Mobility — Engineering Phase 0.46
-- Recover expired Control Room fatigue-handover ownership without weakening passenger continuity.

ALTER TABLE operations.control_room_task_scope
  DROP CONSTRAINT IF EXISTS control_room_task_scope_purpose_subject_id_key;

CREATE INDEX IF NOT EXISTS control_room_task_scope_subject_history_idx
  ON operations.control_room_task_scope (purpose, subject_id, valid_until DESC);

ALTER TABLE operations.control_room_outbox_message
  DROP CONSTRAINT IF EXISTS control_room_outbox_message_event_type_check;

ALTER TABLE operations.control_room_outbox_message
  ADD CONSTRAINT control_room_outbox_message_event_type_check CHECK (event_type IN (
    'control-room.fatigue-handover-owned',
    'control-room.fatigue-safe-stop-confirmed',
    'control-room.fatigue-handover-completed',
    'control-room.fatigue-replacement-assignment-recorded',
    'control-room.fatigue-passenger-transfer-recorded',
    'control-room.fatigue-handover-ownership-recovered'
  ));

COMMENT ON INDEX operations.control_room_task_scope_subject_history_idx IS
  'Preserves immutable task history while supporting current-scope and expired-scope ownership decisions.';
