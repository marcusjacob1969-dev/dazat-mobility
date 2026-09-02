-- DAZAT Mobility — Engineering Phase 0.37
-- Server-evidenced qualifying rest and governed Driver fatigue clearance.

ALTER TABLE driver.driver_shift_event
  DROP CONSTRAINT IF EXISTS driver_shift_event_event_type_check;
ALTER TABLE driver.driver_shift_event
  ADD CONSTRAINT driver_shift_event_event_type_check CHECK (event_type IN (
    'SHIFT_STARTED','WORK_INTENT_CHANGED','OFFER_ACCEPTED','JOURNEY_COMPLETED_AVAILABLE',
    'UNSAFE_TERMINATION_BREAK','SHIFT_ENDED','REST_COMPLETED'
  ));

ALTER TABLE driver.daily_operations_outbox_message
  DROP CONSTRAINT IF EXISTS daily_operations_outbox_message_event_type_check;
ALTER TABLE driver.daily_operations_outbox_message
  ADD CONSTRAINT daily_operations_outbox_message_event_type_check CHECK (event_type IN (
    'driver.connectivity-reconciled','driver.support-case-opened','driver.work-intent-changed',
    'driver.shift-ended','driver.fatigue-self-reported','driver.fatigue-rest-cleared'
  ));

CREATE OR REPLACE VIEW driver.current_fatigue_safety_projection AS
SELECT profile.id AS driver_profile_id,
       shift.id AS driver_shift_session_id,
       shift.started_at AS shift_started_at,
       rest.rest_started_at AS last_qualifying_rest_started_at,
       rest.rest_ended_at AS last_qualifying_rest_ended_at,
       EXISTS (
         SELECT 1 FROM driver.driver_fatigue_observation observation
          WHERE observation.driver_profile_id = profile.id
            AND observation.driver_shift_session_id = shift.id
            AND observation.status = 'ACTIVE'
            AND observation.observation_type = 'DRIVER_REPORTED_FATIGUE'
       ) AS driver_reported_fatigue,
       EXISTS (
         SELECT 1 FROM driver.driver_fatigue_observation observation
          WHERE observation.driver_profile_id = profile.id
            AND observation.driver_shift_session_id = shift.id
            AND observation.status = 'ACTIVE'
            AND observation.observation_type = 'DROWSINESS_SIGNAL'
       ) AS drowsiness_signal_observed
  FROM driver.driver_profile profile
  LEFT JOIN driver.driver_shift_session shift
    ON shift.driver_profile_id = profile.id AND shift.status = 'ACTIVE'
  LEFT JOIN LATERAL (
    SELECT started.occurred_at AS rest_started_at, ended.occurred_at AS rest_ended_at
      FROM driver.driver_shift_event ended
      JOIN LATERAL (
        SELECT event.occurred_at
          FROM driver.driver_shift_event event
         WHERE event.driver_shift_session_id = ended.driver_shift_session_id
           AND event.to_availability = 'BREAK'
           AND event.occurred_at < ended.occurred_at
         ORDER BY event.occurred_at DESC LIMIT 1
      ) started ON true
     WHERE ended.driver_shift_session_id = shift.id
       AND ended.from_availability = 'BREAK'
       AND (ended.to_availability IN ('AVAILABLE','FINISHING_SOON') OR ended.event_type = 'REST_COMPLETED')
     ORDER BY ended.occurred_at DESC LIMIT 1
  ) rest ON true;
