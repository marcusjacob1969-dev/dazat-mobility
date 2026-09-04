-- DAZAT Mobility — Engineering Phase 0.47
-- Bounded supervisor discovery of expired, currently unowned fatigue handovers.

CREATE INDEX IF NOT EXISTS control_room_task_scope_recovery_lookup_idx
  ON operations.control_room_task_scope (subject_id, valid_until DESC)
  WHERE purpose = 'DRIVER_FATIGUE_HANDOVER';

COMMENT ON INDEX operations.control_room_task_scope_recovery_lookup_idx IS
  'Supports minimum-data Safety-supervisor discovery; the recovery command still locks and revalidates authoritative state.';
