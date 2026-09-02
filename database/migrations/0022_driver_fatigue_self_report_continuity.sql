-- DAZAT Mobility — Engineering Phase 0.36
-- Idempotent Driver fatigue self-report continuity event support.

CREATE UNIQUE INDEX IF NOT EXISTS driver_one_active_fatigue_observation_per_shift_type
  ON driver.driver_fatigue_observation (driver_shift_session_id, observation_type)
  WHERE status = 'ACTIVE';

ALTER TABLE driver.daily_operations_outbox_message
  DROP CONSTRAINT IF EXISTS daily_operations_outbox_message_event_type_check;
ALTER TABLE driver.daily_operations_outbox_message
  ADD CONSTRAINT daily_operations_outbox_message_event_type_check CHECK (event_type IN (
    'driver.connectivity-reconciled','driver.support-case-opened','driver.work-intent-changed',
    'driver.shift-ended','driver.fatigue-self-reported'
  ));
