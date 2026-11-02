ALTER TABLE sessions
  ADD COLUMN tutor_checked_in_at DATETIME NULL AFTER tutee_checked_in_at;
