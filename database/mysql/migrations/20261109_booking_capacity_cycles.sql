-- Additive booking metadata for per-tutor capacity, temporary reservations and cycles.
-- Existing booking/session records are preserved. Legacy requests remain reviewable.
ALTER TABLE bookings
  ADD COLUMN session_type ENUM('one-on-one','group') NOT NULL DEFAULT 'one-on-one' AFTER booking_type,
  ADD COLUMN cycle_type ENUM('2-week','3-week','1-month') NULL AFTER session_type,
  ADD COLUMN cycle_start DATE NULL AFTER cycle_type,
  ADD COLUMN cycle_end DATE NULL AFTER cycle_start,
  ADD COLUMN cycle_session_allowance SMALLINT UNSIGNED NULL AFTER cycle_end,
  ADD COLUMN expires_at DATETIME NULL AFTER cycle_session_allowance,
  ADD COLUMN expiration_warning_at DATETIME NULL AFTER expires_at,
  MODIFY COLUMN status ENUM('awaiting_admin','confirmed','rejected','terminated','completed','expired','cancelled') NOT NULL;

ALTER TABLE sessions ADD COLUMN assignment_id VARCHAR(64) NULL AFTER id;
UPDATE sessions SET assignment_id = id WHERE assignment_id IS NULL;
ALTER TABLE sessions MODIFY COLUMN assignment_id VARCHAR(64) NOT NULL;

-- Bring current cohort settings in line with the fixed Playgroup schedule.
UPDATE cohorts SET capacity = 6, class_time = '10:00', weekdays = JSON_ARRAY(1,3,5), modality = 'face-to-face'
WHERE JSON_LENGTH(enrolled) <= 6;

-- A shared Academic Group occupies one tutor assignment; its student rows remain
-- separate in sessions and are limited to two by the application transaction.
CREATE INDEX idx_sessions_date_time_tutor_status ON sessions(session_date, session_time, tutor_id, status);
CREATE INDEX idx_bookings_pending_expiry ON bookings(status, expires_at);
