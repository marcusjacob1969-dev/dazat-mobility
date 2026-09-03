-- DAZAT Mobility — Engineering Phase 0.45
-- Transactional notification for evidence-governed passenger transfer.

ALTER TABLE operations.control_room_outbox_message
  DROP CONSTRAINT IF EXISTS control_room_outbox_message_event_type_check;
ALTER TABLE operations.control_room_outbox_message
  ADD CONSTRAINT control_room_outbox_message_event_type_check CHECK (event_type IN (
    'control-room.fatigue-handover-owned',
    'control-room.fatigue-safe-stop-confirmed',
    'control-room.fatigue-handover-completed',
    'control-room.fatigue-replacement-assignment-recorded',
    'control-room.fatigue-passenger-transfer-recorded'
  ));
