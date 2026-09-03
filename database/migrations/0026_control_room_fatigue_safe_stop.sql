-- DAZAT Mobility — Engineering Phase 0.42
-- Evidence-governed safe-stop confirmation without premature hold release or completion.

ALTER TABLE operations.control_room_outbox_message
  DROP CONSTRAINT IF EXISTS control_room_outbox_message_event_type_check;
ALTER TABLE operations.control_room_outbox_message
  ADD CONSTRAINT control_room_outbox_message_event_type_check CHECK (event_type IN (
    'control-room.fatigue-handover-owned','control-room.fatigue-safe-stop-confirmed'
  ));
